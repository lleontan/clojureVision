# Hosts a webpage that indentifies details about submitted images.
# Hosts a POST server that takes images and returns details about them from google images.
# server runs on http://localhost:4536/
# Vision api endpoint is "/vision"
# Http Server endpoint is "/"
require 'socket'
require 'net/http'
require 'net/https'
require 'uri'
require 'webrick'
require 'launchy'
require 'json'
require 'open-uri'

DEFAULT_PORT = 4536
DEFAULT_HTML_PATH = 'index.html'.freeze
DEFAULT_JS_PATH = 'googleVisionTest.js'.freeze
VISION_URL='https://vision.googleapis.com/v1/images:annotate?key=AIzaSyCut3bWAFz-MasgqQgmEEl8_mYq_tmOGIs'
# Responds to a request with the requested file.
# _request - webrick request object.
# _response - webrick response object.
def ServeFile(_request, _response)
  path = _request.path
  unless path.empty?
    path = path[1..path.length] # The '/' at the beginning causes errors
  end
  contentType = 'text/html'
  if path.end_with?('.jpg')
    contentType = 'image/jpeg'
  elsif path.end_with?('.css')
    contentType = 'text/css'
  elsif path.end_with?('.png')
    contentType = 'image/png'
  elsif path.end_with?('.js')
    contentType = 'text/javascript'
  end
  puts "contentType #{contentType}:path #{path}"
  if File.exist?(path) && !File.directory?(path)
    File.open(path, 'rb') do |_file|
      _response.status = 200
      _response['Content-Type'] = contentType
      _response.body = File.open(path, &:read)
    end
#=begin
  elsif path.include? "www."
    open(path) do |_file|
      _response.status = 200
      _response['Content-Type'] = contentType
      _response.body = open(path, &:read)
    end
#=end
  else
    File.open(DEFAULT_HTML_PATH, 'rb') do |_file|
      _response.status = 200
      _response['Content-Type'] = 'text/html'
      _response.body = File.open(DEFAULT_HTML_PATH, &:read)
    end
  end
end
class HtmlServlet < WEBrick::HTTPServlet::AbstractServlet
  def do_GET(_request, _response)\
    ServeFile(_request, _response)
  end
end

class VisionServlet < WEBrick::HTTPServlet::AbstractServlet
  def do_POST(_request, _response)
    bodyObj = JSON.parse(_request.body)
    image=bodyObj['image']
    mode=bodyObj['mode']
    puts "VISION SERVLET MODE #{mode}"
    if mode == 'labels'
       queryLabels(_request, _response,image)
    elsif mode == 'TEXT_DETECTION'
      queryText(_request, _response,image)
    end
  end
end
#Gets a external image
class ExternalVisionServlet < WEBrick::HTTPServlet::AbstractServlet
  def do_POST(_request, _response)
    bodyObj = JSON.parse(_request.body)
    image=bodyObj['image']
    mode=bodyObj['mode']
    puts "VISION SERVLET MODE #{mode}"
    if mode == 'labels'
       queryLabels(_request, _response,image)
    elsif mode == 'TEXT_DETECTION'
      queryText(_request, _response,image)
    end
  end
end

#Calls the google cloud API to get labels of the image.
#responds to the post request with the response json.
# _request - webrick request object.
# _response - webrick response object.
# image - base64 string of the image
def queryLabels(_request, _response,image)
  call_features=[{
    type: 'LABEL_DETECTION',
    maxResults: 1
  }]
  results=apiRequest(image,call_features)
  _response.status = 200
  _response['Content-Type'] = 'application/json'
  _response.body=results.body
end
#Calls the google cloud API to get text of the image.
#responds to the post request with the response json.
# _request - webrick request object.
# _response - webrick response object.
# image - base64 string of the image
def queryText(_request, _response,image)
  call_features=[{
    type: 'TEXT_DETECTION',
    maxResults: 1
  }]
  results=apiRequest(image,call_features)
  _response.status = 200
  _response['Content-Type'] = 'application/json'
  _response.body=results.body
end
#Takes a base64String of a image and returns details from google vision.
#{string} image_string: image encoded as a base64 String.
#returns {json string}:See https://cloud.google.com/vision/docs/request for details
def apiRequest(base_string,call_features)
  uri = URI.parse(VISION_URL)
  #image string may be of format data:image/png;base64,#{base64_string}
  image_string=base_string
  if base_string.start_with?("data:image/png;base64,")
    image_string=base_string["data:image/png;base64,".length..base_string.length]
  end
  post_body={
    "requests":[
      {
        'image':{
          'content':image_string
        },
        'features':call_features
      }
    ]
  }
  header = {'Content-Type' =>'application/json'}
  http = Net::HTTP.new(uri.host, uri.port)
  http.use_ssl = true
  request = Net::HTTP::Post.new(uri.request_uri, header)
  request.body = post_body.to_json
  response = http.request(request)
  response
end

server = WEBrick::HTTPServer.new(Port: DEFAULT_PORT)

server.mount '/', HtmlServlet
server.mount '/vision', VisionServlet
server.mount '/externalVision', ExternalVisionServlet


trap('INT') do
  server.shutdown
end
Launchy.open("http://localhost:#{DEFAULT_PORT}/")

server.start
