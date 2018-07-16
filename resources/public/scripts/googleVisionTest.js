/* Sends images to an api to be processed and displays the results on the webpage.
 */
"use strict";
(function () {
  const API_CALLBACKS = {
    "Labels": {
      mode: "labels",
      callback: onLabelDetectionReply
    },
    "Text Detection": {
      mode: "TEXT_DETECTION",
      //  callback: printJsonToOutput
      callback: drawTextAnnotations
    },
    "Face Detection": {
      mode: "FACE_DETECTION",
      callback: drawFaces
    }
  };

  const DEFAULT_IMG_URL = "../images/omnafield.png"; //Default image url for testing.
  const DEFAULT_API_URL = "http://localhost:3000/";
  let antiForgeryToken;
  let naturalX = 500;
  let naturalY = 500;

  function drawTextAnnotations(jsonString) {
    printJsonToOutput(jsonString);
    let imgData = JSON.parse(jsonString);
    let responses = imgData.responses;
    let maxResponses = responses.length;
    for (let i = 0; i < maxResponses; i++) {
      drawPolygon(responses[i].textAnnotations, naturalX, naturalY);
    }
  }

  function drawFaces(jsonString) {
    printJsonToOutput(jsonString);
    let imgData = JSON.parse(jsonString);
    let responses = imgData.responses;
    let maxResponses = responses.length;
    for (let i = 0; i < maxResponses; i++) {
      drawPolygon(responses[i].faceAnnotations, naturalX, naturalY);
    }
  }

  function drawPolygon(boxesList, imageWidth, imageHeight) {
    let polygonsDiv = document.getElementById("boundingBoxes")
    console.log(imageWidth, Number(polygonsDiv.style.width.replace(/[^\d\.\-]/g, '')));
    let widthRatio = Number(polygonsDiv.style.width.replace(/[^\d\.\-]/g, '')) / imageWidth;
    let heightRatio = Number(polygonsDiv.style.height.replace(/[^\d\.\-]/g, '')) /
      imageHeight;

    let polyLength = boxesList.length;
    for (let i = 0; i < polyLength; i++) {
      let box = boxesList[i];
      let newBox = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
      let boundingPoly = box.boundingPoly;
      let verts = boundingPoly.vertices;
      let pointsString = "";
      let maxVertices = verts.length;
      for (let j = 0; j < maxVertices; j++) {
        let point = verts[j];
        let pointX = Math.round(point.x * widthRatio);
        let pointY = Math.round(point.y * heightRatio);
        pointsString = pointsString + " " + pointX + "," + pointY;
      }
      newBox.setAttributeNS(null, "points", pointsString.trim());
      polygonsDiv.appendChild(newBox);
    }

  }

  function printJsonToOutput(jsonStr) {
    let jsonData = JSON.parse(jsonStr);
    let jsonStringOutput = document.getElementById("jsonStringOutput");
    if (Object.keys(jsonData.responses).length === 0) {
      jsonStringOutput.innerText = "No Features Detected";
    } else {
      jsonStringOutput.innerText = JSON.stringify(
        jsonData, null, 2);
    }
  }
  /** Reads a file from the element converts it to a base64String and returns the result.
  @param {file} file - The file to encode.
  @return {string} - file as a base64String
   */
  function encodeImageFileAsURL(file) {
    let reader = new FileReader();
    reader.onloadend = function (e) {
      document.getElementById("currentImg").src = e.target.result;
      sendImageAsString(reader.result);
    }
    reader.readAsDataURL(file);
  }

  /** Changes the preview image to the file loaded in the file select input.
   */
  function imagePreviewToSelectedFile() {
    let reader = new FileReader();
    reader.onload = function (e) {
      let resultingImage = e.target.result;
      let imageElement = document.getElementById("currentImg");
      imageElement.src = resultingImage;
    }
    reader.readAsDataURL(document.getElementById("picUpload").files[0]);
  }
  /*Tells the server to preform image processing on the url*/
  function queryExternalImg(url) {
    makeProcessingCall(url, makeExternalImagePost)
  }

  function makeExternalImagePost(callFunction, packageBody) {
    onImagePostStartSettings();
    doFetch("externalVision", callFunction, {
      method: "POST",
      body: packageBody
    });
  }

  function makeProcessingCall(imageString, callFunction) {
    let modeName = document.getElementById("modeSelect").value;
    let onReplyFunction = API_CALLBACKS[modeName].callback;
    /*let packageBody = new FormData();
    packageBody.append("mode", API_CALLBACKS[modeName].mode);
    packageBody.append("image", imageString);*/
    let packageBody = {
      mode: API_CALLBACKS[modeName].mode,
      image: imageString
    }
    callFunction(onReplyFunction, JSON.stringify(packageBody));
  }
  /** Sends a image to the api to be processed.
  @param {string} result- base64 encoded string of the image.
  @param {function} onReplyFunction- Callback when replied to successfully.
  @param {string} apiMode- vision call mode.
  */
  function sendImageAsString(result) {
    makeProcessingCall(result, makeImagePost);
  }

  function onImagePostStartSettings() {
    document.getElementById("labelAnnotations").classList.add("hidden");
    document.getElementById("textOutput").innerText = "Loading";
  }

  /** Makes POST call to the default API and calls the given function using the returned data.
  @param {function} callFunction - the function to call on a properly executed request.
  @param {object} packageBody - The request's body paramter. Will be stringified into JSON. */
  function makeImagePost(callFunction, packageBody) {
    onImagePostStartSettings();
    doFetch("vision", callFunction, {
      method: "POST",
      body: packageBody
    });
  }

  function clearPolygons() {
    let polygonsSvg = document.getElementById("boundingBoxes");
    let polygons = document.querySelector("#boundingBoxes>polygon");
    for (let polygon in polygons) {
      polygonsSvg.removeChild(polygon);
    }
  }

  /** Preforms a fetch call on the default API and calls the given function when replied to.
  @param {string} urlSuffix - the string to append to the base api link.
  @param {function} callFunction - the function to call on a valid request.
  @param {object} params - The request's parameters. */
  function doFetch(urlSuffix, callFunction, params) {
    clearPolygons();
    let allHeaders = new Headers({
      'Content-Length': JSON.stringify(params['body']).length,
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "*",
      "X-CSRF-Token": antiForgeryToken,
      "Content-Type": "application/json; charset=utf-8",
      "Accept-Encoding": "deflate"
    });
    params.mode = "cors";
    params.headers = allHeaders;
    console.log(params);
    fetch(DEFAULT_API_URL + urlSuffix, params)
      .then(checkStatus)
      .then(callFunction)
      .catch(onCatchError)
  }
  /** Resets loading messages when a query is finished
   */
  function onVisionRequestLoaded() {
    document.getElementById("textOutput").innerText = "Results";
  }
  /**Resets loading messages and displays an error message.*/
  function onCatchError(statusMessage) {
    onVisionRequestLoaded();
    errorMessage(statusMessage);
  }

  /**Tells the user that an error has occured with a fetch request.
  @param {string} statusMessage - The message to display */
  function errorMessage(statusMessage) {
    console.log(statusMessage);
    document.getElementById("textOutput").innerText = "Error: " + statusMessage;
  }

  /** Checks the response status and if valid returns the response.
  If invalid prints an error message to the console.
  @param {object} response - Response from server
  @return {string} - The server's response. */
  function checkStatus(response) {
    onVisionRequestLoaded();
    //console.log(response.text());
    if (response.status >= 200 && response.status < 300) {
      return response.text();
    } else {
      return Promise.reject(new Error(response.status + ":" + response.statusText));
    }
  }

  /** Submits the currently selected image to the api if it exists.
   */
  function submitImage() {
    let image = document.querySelector('input[type=file]').files[0];
    if (image) {
      encodeImageFileAsURL(image);
    } else {
      errorMessage("No Selected File");
    }
  }

  /**Prints the results of a label detection fetch to the output.
    Reveals the output.
    @param {string} str-unparsed json string of the response from the api.
   */
  function onLabelDetectionReply(str) {
    let jsonData = JSON.parse(str);
    let outputParagraph = document.getElementById("textOutput");
    let responses = jsonData['responses'];
    let labelAnnotations = responses[0]['labelAnnotations'][0];
    document.getElementById("labelAnnotations").classList.remove("hidden");
    document.getElementById("description").innerText = labelAnnotations[
      'description'];
    document.getElementById("mid").innerText = labelAnnotations['mid'];
    document.getElementById("score").innerText = labelAnnotations['score'];
    document.getElementById("topicality").innerText = labelAnnotations[
      'topicality'];
    //outputParagraph.innerText = str;

  }

  /** Converts a local url to a base64string and submits it as a parameter to a callback.
  @param {string} src-url of image, must be local.
  @param {function} callback-function to call onloadend.
  */
  function toDataURL(src, callback) {
    try {
      let xhttp = new XMLHttpRequest();

      xhttp.onload = function () {
        let fileReader = new FileReader();
        fileReader.onloadend = function () {
          callback(fileReader.result);
        }
        fileReader.readAsDataURL(xhttp.response);
      };
      xhttp.open('GET', src, true);

      xhttp.responseType = 'blob';
      xhttp.send();
    } catch (Ex) {
      errorMessage("Something went wrong somewhere");
    }
  }

  /**Reads the url from #urlInput, checks for validity and submits the image.
  WARNING ONLY WORKS FOR LOCAL URLS AT THE MOMENT, NEEDS FIXING.
  */
  function submitURL() {
    let urlInput = document.getElementById("urlInput");
    let url = urlInput.value;
    let urlRegex = /^.+\.(png|jpg)$/;
    let regexResults = url.match(urlRegex);
    if (regexResults.length > 0) {
      let currentImg = document.getElementById("currentImg");
      currentImg.src = url;
      queryExternalImg(url);
    } else {
      urlInput.value = "";
      errorMessage("Invalid URL " + regexResults);
    }
  }

  /** On load sets onclick handlers and onchange handlers.
   */
  window.onload = function () {
    fetch(DEFAULT_API_URL + "session", {
        method: "GET"
      })
      .then(checkStatus)
      .then(function (jsonStr) {
        antiForgeryToken = JSON.parse(jsonStr)["csrf-token"];
        console.log(antiForgeryToken);
      })
      .catch(onCatchError)
    let imageElement = document.getElementById("currentImg");
    imageElement.onload = function () {
      let boxes = document.getElementById("boundingBoxes");
      boxes.style.width = this.width;
      boxes.style.height = this.height;
      naturalX = Number(imageElement.naturalWidth);
      naturalY = Number(imageElement.naturalHeight);

    }
    document.getElementById("defaultImageSubmit").onclick = function () {
      document.getElementById("currentImg").src = DEFAULT_IMG_URL;
      toDataURL(DEFAULT_IMG_URL, sendImageAsString);
    }
    document.getElementById("picUpload").onchange = function (e) {
      imagePreviewToSelectedFile();
    }
    let submitButton = document.getElementById("submitButton");
    submitButton.addEventListener("click", function (event) {
      event.preventDefault();
      submitImage();
    });
    document.getElementById("urlSubmitButton").onclick = submitURL;
    let modeSelect = document.querySelector("#modeSelect");
    modeSelect.innerHTML = "";
    for (let key in API_CALLBACKS) {
      let newOption = document.createElement("option");
      newOption.innerText = key;
      modeSelect.appendChild(newOption);
    }
  }
})();
