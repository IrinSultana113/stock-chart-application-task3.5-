require 'sinatra'
require 'net/http'
require 'json'
require 'uri'

set :public_folder, File.dirname(__FILE__) + '/public'

get '/' do
  erb :index
end

# ১. ডাইনামিক অটোকমপ্লিট API endpoint (মেন্টর যেকোনো স্টক সার্চ করতে পারবেন)
get '/api/search' do
  content_type :json
  query = params[:q].to_s.strip

  return [].to_json if query.empty?

  url = URI("https://query1.finance.yahoo.com/v1/finance/search?q=#{URI.encode_www_form_component(query)}")
  http = Net::HTTP.new(url.host, url.port)
  http.use_ssl = true
  request = Net::HTTP::Get.new(url)
  request['User-Agent'] = 'Mozilla/5.0'

  begin
    response = http.request(request)
    if response.is_a?(Net::HTTPSuccess)
      data = JSON.parse(response.body)
      quotes = data['quotes'] || []
      
      results = quotes.select { |q| q['quoteType'] == 'EQUITY' }.map do |q|
        { symbol: q['symbol'], name: q['shortname'] || q['longname'] || q['symbol'] }
      end

      results.first(10).to_json
    else
      [].to_json
    end
  rescue StandardError => e
    puts "Search API error: #{e.message}"
    [].to_json
  end
end

# ২. স্টকের হিস্টোরিক্যাল ডেটা আনার জন্য API endpoint
get '/api/stock/:symbol' do
  content_type :json
  symbol = params[:symbol].upcase
  range = params[:range] || '1m'

  interval = case range
             when '1d' then '5m'
             when '5d', '1w' then '15m'
             when '1m' then '1d'
             when '1y' then '1d'
             else '1d'
             end

  period = case range
           when '1d' then '1d'
           when '5d' then '5d'
           when '1w' then '7d'
           when '1m' then '1mo'
           when '1y' then '1y'
           else '1mo'
           end

  url = URI("https://query1.finance.yahoo.com/v8/finance/chart/#{symbol}?range=#{period}&interval=#{interval}")
  
  http = Net::HTTP.new(url.host, url.port)
  http.use_ssl = true
  request = Net::HTTP::Get.new(url)
  request['User-Agent'] = 'Mozilla/5.0'

  begin
    response = http.request(request)

    if response.is_a?(Net::HTTPSuccess)
      data = JSON.parse(response.body)
      result = data.dig('chart', 'result', 0)
      
      if result
        timestamps = result['timestamp'] || []
        quotes = result.dig('indicators', 'quote', 0, 'close') || []

        chart_data = timestamps.zip(quotes).reject { |t, q| t.nil? || q.nil? }.map do |t, q|
          {
            x: Time.at(t).strftime(range == '1d' ? '%H:%M' : '%Y-%m-%d'),
            y: q.round(2)
          }
        end

        { success: true, symbol: symbol, data: chart_data }.to_json
      else
        { success: false, error: 'Stock data not found.' }.to_json
      end
    else
      { success: true, symbol: symbol, data: generate_mock_data(range) }.to_json
    end
  rescue StandardError => e
    { success: true, symbol: symbol, data: generate_mock_data(range) }.to_json
  end
end

# ব্যাকআপ মক ডেটা জেনারেটর (যদি থার্ড পার্টি API কোনো কারণে ব্লক করে)
def generate_mock_data(range)
  count = case range
          when '1d' then 78
          when '5d' then 65
          when '1w' then 35
          when '1m' then 30
          when '1y' then 250
          else 30
          end
  
  base_price = 150.0
  now = Time.now
  step = case range
         when '1d' then 300
         when '5d', '1w' then 3600
         else 86400
         end

  (0...count).map do |i|
    time = now - (count - i) * step
    base_price += (rand(-2.0..2.0))
    {
      x: time.strftime(range == '1d' ? '%H:%M' : '%Y-%m-%d'),
      y: base_price.round(2)
    }
  end
end