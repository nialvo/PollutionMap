//API Key for pollution pull and URL for IP address.
const AQkey = "03e6687524e359bbf0987c0f2ede90cb945e4404"
const ipUrl = 'https://ipapi.co/json/'
//Location declarations.
let lon, lat, zip, city
//width and height of grid, !! must be odd !!
const gridSize = 9
//Available pollution types.
const pollTypes = ["pm25", "no2", "co", "so2", "nh3", "o3", "pm10"]
const pollNames = ["PM<sub>2.5</sub>", "NO<sub>2</sub>", "CO", "SO<sub>2</sub>", "NH<sub>3</sub>", "O<sub>3</sub>", "PM<sub>10</sub>"]
//Increment
const orInc = 35//43.6906666666666
const radC = 15
let RAD
let widthP
const sizer = document.getElementById("overlayContainer")
widthP = Math.min(parseInt(getComputedStyle(sizer).getPropertyValue('width')) / 600)
var Inc = orInc
//These three must change with zoom, or first two musy change when user changes zoom.
let lonInc
let latInc = .48
let zoomLevel = 7
//Map and styling declarations.
let features, greyFeature, map, vectorSource, vectorLayer, p, selectedFeat, oldStyle, isMouseDown, T, isScrolling, searched, clicked
//'p' in drawGrid loop function is to enumerate the points on the grid:
/*678
  345
  012*/
//DOM element declarations.
const overlayContainerEl = document.querySelector('.ol-popup')
const popupInfo = document.querySelector('.ol-popup-closer')
const llTitle = document.getElementById("levelsTitle")
const llContent = document.getElementById("levelsContent")
const locationInput = document.getElementById("enterZip")
locationInput.value = ""
const disp = document.getElementById("disp")
//Map buttons.
const currentLoc = document.getElementById('currentLoc')
currentLoc.addEventListener("click", localSearch)
const OK = document.getElementById("ok")
OK.addEventListener("click", myFunction)
const searchCurrentEl = document.getElementById('here')
searchCurrentEl.addEventListener("click", searchCurrent)
searchCurrentEl.setAttribute('style', 'visibility: hidden')
//localStorage HTML elements.
const HDISP = document.getElementById("displayedSearches")
let fs = 0;//index of first stored element to display
const PREV = document.getElementById("seePrev")
PREV.addEventListener("click", seePrev)
const NEXT = document.getElementById("seeNext")
NEXT.addEventListener("click", seeNext)
const ERASE = document.getElementById("eraseSearches")
ERASE.addEventListener("click", eraseSearches)
overlayContainerEl.style.display = "none"
document.addEventListener('keypress', function (e) {
    if (e.code == 'Enter' || e.key === 'Enter') {
        e.preventDefault()
        return false
    }
})
if (localStorage.getItem('place7896') == null) {
    var storedSearches = [[], []]
    for (let v = 0; v < 3; v++) {
        HDISP.children[v].children[0].textContent = ""
        HDISP.children[v].children[1].textContent = ""
    }
    displaySearches(fs)
}
else {
    var storedSearches = [JSON.parse(localStorage.place7896), JSON.parse(localStorage.levels7896)]
    displaySearches(fs)
}
let startClick
//Event listener function for host's current location in real life.
function localSearch() {
    searchCurrentEl.setAttribute('style', 'visibility: hidden')
    currentLoc.setAttribute('style', 'visibility: hidden')
    start()
}
//Event listener function for search host's location on map.
function searchCurrent() {
    searched = true
    searchCurrentEl.setAttribute('style', 'visibility: hidden')
    currentLoc.setAttribute('style', 'visibility: hidden')
    changeCoord()
}
//Event listener function for new search location.
function myFunction() {
    clicked = true
    if (/^\d{5}(-\d{4})?$/.test(locationInput.value) && locationInput.value.length == 5) changeZip(locationInput.value)
    else if (locationInput.value == undefined || locationInput.value.length < 2 || (/^\d+$/.test(locationInput.value))) {
        locationInput.value = ''
        return locationInput.placeholder = " Please enter a valid location..."
    }
    else {
        city = locationInput.value;
        searchLocation(locationInput.value);
    }
}
//Start the program
start()
//launches when page loads, get location from IP and draw map.
function start() {
    clearM()
    zoomLevel = 7
    searchCurrentEl.setAttribute('style', 'visibility: hidden')
    currentLoc.setAttribute('style', 'visibility: hidden')
    fetch(ipUrl).then(function (response) {
        return response.json()
    }).then(function (data) {
        //Checks if IP returns a geo location.
        if (data.latitude && data.longitude) {
            lat = data.latitude
            lon = data.longitude
            ogLat = lat
            ogLon = lon
            if (data.city) {
                city = data.city
                if (city == "") {
                    city = "Unnamed location"
                }
            }
            else {
                city = "Unnamed location"
            }
            if (data.postal) {
                zip = data.postal
            }
            else {
                zip = "00000"
            }
        }
        //If this ip does not return a geo location, then give Beverly Hills because that's where I wanna be.
        else {
            lat = 34.07440
            lon = -117.40499
            zip = "90210"
            city = "Beverley Hills"
        }
        locationInput.value = zip
        widthP = Math.min(parseInt(getComputedStyle(sizer).getPropertyValue('width')) / 600)
        latInc = Inc * widthP * 0.010986328125
        RAD = radC * widthP
        drawGrid(lat, lon, gridSize, city)
        locationInput.value = ''
    }).catch(function () {
        console.log("ERROR: BAD IP FETCH")
        lat = 34.07440
        lon = -117.40499
        zip = "90210"
        city = "Beverley Hills"
        locationInput.value = zip
        widthP = Math.min(parseInt(getComputedStyle(sizer).getPropertyValue('width')) / 600)
        latInc = Inc * widthP
        RAD = radC * widthP
        drawGrid(lat, lon, gridSize, city)
        locationInput.value = ''
    })
}
//Initial grid draw.
function drawGrid(lati, lonj, s, City) { //'s' is width and height of grid.      
    locationInput.value = ''
    locationInput.placeholder = "Enter a location..."
    searched = false
    eraseSearchDisplay()
    displaySearches(fs)
    localStorage.place7896 = JSON.stringify(storedSearches[0])
    localStorage.levels7896 = JSON.stringify(storedSearches[1])
    //Make increments 'latInc' and 'lonInc' equal in distance at center.
    lonInc = latInc / Math.cos(lati * 0.0174533)
    //Number of points on each side of central point.
    const half = s / 2 - .5
    features = []
    p = 0
    greyFeatures = []
    for (let i = 0; i < s; i++) {
        for (let j = 0; j < s; j++) {
            let la = lati - half * latInc + i * latInc
            let lo = lonj - half * lonInc + j * lonInc
            //Pollution fetch request.
            const pollutionUrl = "https://api.waqi.info/feed/geo:" + la + ";" + lo + "/?token=" + AQkey
            fetch(pollutionUrl).then(function (response) {
                return response.json()
            }).catch(function () {
                console.log("ERROR: NO RESPONSE")
            }).then(function (data) {
                //If we are at central point, display pollution levels of the point in 'llTitle'.
                if (i == half && j == half) {
                    llTitle.textContent = "The pollution levels in " + city + " are:"
                    for (let m = 0; m < 7; m++) {
                        llContent.children[m].textContent = ""
                    }
                    let z = 0;
                    let xx = 0;
                    let sstr = "";
                    for (const potype of pollTypes) {
                        if (potype in data.data.iaqi) {
                            llContent.children[z].innerHTML = pollNames[xx] + ": " + data.data.iaqi[potype].v
                            sstr = sstr + llContent.children[z].innerHTML + "&nbsp&nbsp&nbsp"
                            z++
                        }
                        xx++;
                    }
                    if (sstr.length == 0) {
                        sstr = "no data"
                        llContent.children[0].innerHTML = "no data"
                    }
                    //Logs the central point to localStorage.
                    storedSearches[0].push(city + " " + zip)
                    storedSearches[1].push(sstr)
                }
                //Pushes new points on the map display, describes a grid centered at lati lonj
                features.push(new ol.Feature({
                    geometry: new ol.geom.Point(ol.proj.fromLonLat([lo, la]))
                }))
                //Get PM25 level and set color of point to match level.
                let q = data.data.iaqi["pm25"].v
                let colorStyle = new ol.style.Style({
                    image: new ol.style.Circle({
                        radius: RAD,
                        //set color with rgb
                        fill: new ol.style.Fill({
                            color: [Math.min(q * 2, 255), Math.max(255 - q * 2, 0), Math.min(Math.max(0, 2 * (q - 70)), 255)]
                        })
                    })
                })
                //Applies an id of 'color' to each point with no data.
                let str = "";
                let zz = 0;
                for (const ptype of pollTypes) {
                    if (ptype in data.data.iaqi) {
                        str = str + pollNames[zz] + ": " + data.data.iaqi[ptype].v + "<br>";
                    }
                    zz++
                }
                str = str.slice(0, -4);
                features[p].set('id', str)
                features[p].setStyle(colorStyle)
                //Applies dynamic size adjustment to each feature.
                features[p].setStyle(function (feature, resolution) {
                    colorStyle.getImage().setScale(map.getView().getResolutionForZoom(zoomLevel) / resolution)
                    return colorStyle
                })
                p++
            })
                //Catch occurs when no data available.
                .catch(function () {
                    const greyStyle = new ol.style.Style({
                        image: new ol.style.Circle({
                            radius: RAD,
                            fill: new ol.style.Fill({ color: [130, 131, 130] })//set colors to grey if no data.
                        })
                    })
                    //Applies an id of 'grey' to each point with no data.
                    greyFeatures.push(features[p])
                    let str = "no data here";
                    for (let each of greyFeatures) {
                        each.set('id', str)
                    }
                    features[p].setStyle(greyStyle)
                    //Applies dynamic size adjustment to each feature.
                    features[p].setStyle(function (feature, resolution) {
                        greyStyle.getImage().setScale(map.getView().getResolutionForZoom(zoomLevel) / resolution)
                        return greyStyle
                    })
                    p++
                    console.log("ERROR: NO DATA FOUND FOR CIRCLE")
                })
                .then(function () {
                    //If we are at final point(p^2) draw map.
                    if (p == 81) {
                        //Creates vector source and vector layer for map projection.
                        vectorSource = new ol.source.Vector({
                            features
                        })
                        vectorLayer = new ol.layer.Vector({
                            source: vectorSource,
                            updateWhileAnimating: true,
                            updateWhileInteracting: true,
                            opacity: 0.5
                        })
                        //Draw map centered on given coordinates.
                        map = new ol.Map({
                            target: 'map',
                            layers: [
                                new ol.layer.Tile({
                                    source: new ol.source.OSM()
                                }), vectorLayer
                            ],
                            view: new ol.View({
                                projection: 'EPSG:4326',
                                center: [lonj, lati],
                                zoom: zoomLevel
                            })
                        })
                        searchCurrentEl.setAttribute('style', 'display: none')
                        currentLoc.setAttribute('style', 'display: none')
                        searchCurrentEl.removeEventListener("click", searchCurrent)
                        currentLoc.removeEventListener("click", localSearch)
                        let highlight
                        //On hit detection of feature, append info to info.innerHTML.
                        const displayFeatureInfo = function (pixel) {
                            vectorLayer.getFeatures(pixel)
                                .then(function (features) {
                                    const feature = features.length ? features[0] : undefined
                                    if (feature !== highlight) {
                                        if (highlight) {
                                            overlayContainerEl.setAttribute("style", "display: none")
                                        }
                                        if (feature) {
                                            overlayContainerEl.setAttribute("style", "display: inline")
                                        }
                                        highlight = feature
                                    }
                                })
                        }
                        disp.children[0].addEventListener('mousedown', function () {
                            isMouseDown = true
                            if (isMouseDown == true) restoreSearchButton()
                        })
                        document.addEventListener('mouseup', function () {
                            if (isMouseDown == true) isMouseDown = false
                            if (isMouseDown == false) {
                                restoreSearchButton()
                                isMouseDown = undefined
                            }
                        })
                        //On mouse hold down and drag, nothing happens.
                        map.on('pointermove', function (evt) {
                            //If there is no dragging, then displayFeatureInfo runs
                            if (evt.dragging) return
                            if (selectedFeat) {
                                selectedFeat.setStyle(oldStyle)
                                pixelAtCoords = ''
                            }
                            selectedFeat = undefined
                            const pixel = map.getEventPixel(evt.originalEvent)
                            map.forEachFeatureAtPixel(evt.pixel, function (feature, layer) {
                                let oldFill = feature.getStyle()
                                let coords = feature.getGeometry().getCoordinates()
                                let pixelCoords = map.getPixelFromCoordinate(coords)
                                let canvasContext = document.querySelectorAll('canvas')[1].getContext('2d')
                                pixelAtCoords = canvasContext.getImageData(pixelCoords[0], pixelCoords[1], 1, 1).data
                                pixelAtCoords = Array.prototype.slice.call(pixelAtCoords)
                                //Highlight version of colorStyle circle for hit detection
                                let highlightStyle = new ol.style.Style({
                                    image: new ol.style.Circle({
                                        radius: RAD,
                                        fill: new ol.style.Fill({
                                            color: [200, 100, 50, 0]
                                        }),
                                        stroke: new ol.style.Stroke({
                                            color: '#0000e6',
                                            width: 3
                                        })
                                    })
                                })
                                //Sets circle color to highlighted version of current color.                             
                                feature.setStyle(function (feature, resolution) {
                                    //highlightStyle.getImage().getFill().setColor(pixelAtCoords)
                                    highlightStyle.getImage().setScale(map.getView().getResolutionForZoom(zoomLevel) / resolution)
                                    return highlightStyle
                                })
                                //Grabs coordinates of selected feature and sets popup to center coordinates.
                                let clickedCoordinate = feature.A.geometry.flatCoordinates
                                let clickedInfo = feature.get('id')
                                popup.setPosition(clickedCoordinate)
                                popupInfo.innerHTML = clickedInfo
                                oldStyle = oldFill
                                selectedFeat = feature
                            })
                            displayFeatureInfo(pixel)
                        })
                        const popup = new ol.Overlay({
                            element: overlayContainerEl,
                            zIndex: 1
                        })
                        map.on('click', function (evt) {
                            //If there is no dragging, then displayFeatureInfo runs
                            if (evt.dragging) return
                            if (selectedFeat) {
                                selectedFeat.setStyle(oldStyle)
                                pixelAtCoords = ''
                            }
                            selectedFeat = undefined
                            const pixel = map.getEventPixel(evt.originalEvent)
                            map.forEachFeatureAtPixel(evt.pixel, function (feature, layer) {
                                let oldFill = feature.getStyle()
                                let coords = feature.getGeometry().getCoordinates()
                                let pixelCoords = map.getPixelFromCoordinate(coords)
                                let canvasContext = document.querySelectorAll('canvas')[1].getContext('2d')
                                pixelAtCoords = canvasContext.getImageData(pixelCoords[0], pixelCoords[1], 1, 1).data
                                pixelAtCoords = Array.prototype.slice.call(pixelAtCoords)
                                //Highlight version of colorStyle circle for hit detection
                                let highlightStyle = new ol.style.Style({
                                    image: new ol.style.Circle({
                                        radius: RAD,
                                        fill: new ol.style.Fill({
                                            color: [200, 100, 50, 0]
                                        }),
                                        stroke: new ol.style.Stroke({
                                            color: '#0000e6',
                                            width: 3
                                        })
                                    })
                                })
                                //Sets circle color to highlighted version of current color.                             
                                feature.setStyle(function (feature, resolution) {
                                    //highlightStyle.getImage().getFill().setColor(pixelAtCoords)
                                    highlightStyle.getImage().setScale(map.getView().getResolutionForZoom(zoomLevel) / resolution)
                                    return highlightStyle
                                })
                                //Grabs coordinates of selected feature and sets popup to center coordinates.
                                let clickedCoordinate = feature.A.geometry.flatCoordinates
                                let clickedInfo = feature.get('id')
                                popupInfo.innerHTML = clickedInfo
                                popup.setPosition(clickedCoordinate)
                                oldStyle = oldFill
                                selectedFeat = feature
                            })
                            displayFeatureInfo(pixel)
                        })
                        //Once map is finished rendering, check points to remove points on water.
                        map.once('rendercomplete', function () {
                            for (let each in features) {
                                features[each].getGeometry().transform('EPSG:3857', 'EPSG:4326')
                                let coords = features[each].getGeometry().getCoordinates()
                                if (isWater(coords)) vectorSource.removeFeature(features[each])
                            }
                            if (ogLat != lati && ogLon != lonj) currentLoc.setAttribute("style", "visibility: visible")
                            clicked = false
                            currentLoc.addEventListener("click", localSearch)
                            OK.addEventListener("click", myFunction)
                        })
                        map.getView().on("change:center", function () {
                            isScrolling = true
                            if (clicked == true) currentLoc.setAttribute("style", "visibility: hidden")
                            else if (clicked == false) currentLoc.setAttribute("style", "visibility: visible")
                            restoreSearchButton()
                        })
                        map.addOverlay(popup)
                    }
                })
        }
    }
}
//Restores search button after T time.
function restoreSearchButton() {
    if ((isMouseDown == true || isMouseDown == undefined) || (isScrolling == true && searched == true)) {
        searchCurrentEl.setAttribute("style", "visibility: hidden")
        searchCurrentEl.removeEventListener("click", searchCurrent)
        currentLoc.removeEventListener("click", localSearch)
        isScrolling = false
        clearTimeout(T)
    }
    if ((isMouseDown == false || isMouseDown == undefined) && isScrolling == false) {
        clearTimeout(T)
        T = setTimeout(function () {
            if (searched == false && clicked == false) {
                searchCurrentEl.setAttribute("style", "visibility: visible")
                currentLoc.addEventListener("click", localSearch)
                searchCurrentEl.addEventListener("click", searchCurrent)
            }
        }, 500)
    }
}
//Get input location data.
function getLocationData() {
    let url
    if (arguments.length === 2) {
        url = "https://api.waqi.info/feed/geo:" + arguments[1] + ";" + arguments[0] + "/?token=" + AQkey
    }
    else {
        url = "https://nominatim.openstreetmap.org/search?q=" + arguments[0] + "&country=USA&format=json"
    }
    return fetch(url)
        .then(function (response) {
            return response.json()
        })
        .catch(function () {
            console.log("ERROR: NO LOCATION FOUND")
        })
        .then(function (data) {
            //Checks if data is an Array type object containing multiple possible locations.
            if (data instanceof Array) return data[0]
            if (data.status !== "ok") return
            data.data.lonLat = [arguments[0], arguments[1]]
            return data.data
        })
}
//Get input location approximate area size in lat/lon
function searchLocation(search) {
    getLocationData(search)
        .then(function (data) {
            if (!data) return
            let box = data.boundingbox
            let left = box[2], right = box[3], bottom = box[0], top = box[1]
            goToLocation(data.lat, data.lon, [left, bottom], [right, top])
        })
}
//Display map of entered location with size dependent on size of location.
function goToLocation(lat, lon, min, max) {
    OK.removeEventListener("click", myFunction)
    if (!map) return
    let points = [min, max, [max[0], min[1]], [min[0], max[1]]]
    let geo = new ol.geom.Polygon([points], "XY")
    clearM()
    map.getView().fit(geo)
    zoomLevel = Math.max(Math.min(map.getView().getZoom(), 14), 4)
    let resolution = map.getView().getResolution()
    widthP = Math.min(parseInt(getComputedStyle(sizer).getPropertyValue('width')) / 600)
    latInc = Inc * resolution * widthP
    RAD = radC * widthP
    drawGrid(lat, lon, gridSize, city)
}
//check to see if feature is on the same blue pixel color as water.
function isWater(coords) {
    const blue = [170, 211, 223]
    var xy = map.getPixelFromCoordinate(coords)
    var canvasContext = document.querySelector('canvas').getContext('2d')
    //Checks four corners of a 9x9 pixel area to detect if feature is potentially over a body of water.
    let width = 9, height = 9
    let not_blues = 0
    const startX = xy[0] - Math.floor(width / 2)
    const startY = xy[1] - Math.floor(height / 2)
    for (let vert = 0; vert < height; vert += 8) {
        for (let hor = 0; hor < width; hor += 8) {
            xy = [hor + startX, vert + startY]
            let pixelAtXY = canvasContext.getImageData(xy[0], xy[1], 1, 1).data
            for (let i = 0; i < blue.length; i++) {
                if (blue[i] !== pixelAtXY[i]) {
                    not_blues++
                    break
                }
            }
        }
    }
    //If three or more pixels are blue, returns true. 
    return not_blues < 3
}
function changeZip(zipCode) {
    const zipUrl = "https://nominatim.openstreetmap.org/search?postalcode=" + zipCode + "&country=USA&format=json"
    fetch(zipUrl).then(function (response) {
        return response.json()
    }).then(function (data) {
        zoomLevel = 11
        lat = data[0].lat
        lon = data[0].lon
        city = data[0].display_name.substring(0, data[0].display_name.indexOf(","))
        let resolution = 0.0006866455078125
        widthP = Math.min(parseInt(getComputedStyle(sizer).getPropertyValue('width')) / 600)
        latInc = Inc * resolution * widthP
        RAD = radC * widthP
        clearM()
        drawGrid(lat, lon, gridSize, city)
        searchCurrentEl.setAttribute('style', 'visibility: hidden')
        currentLoc.setAttribute('style', 'visibility: hidden')
        searchCurrentEl.removeEventListener("click", searchCurrent)
        currentLoc.removeEventListener("click", localSearch)
    }).catch(function () {
        zipCode = "Please enter a valid ZIP..."
        locationInput.value = ""
        locationInput.placeholder = zipCode
    })
}
//Changes central coordinates to current center of map, and changes feature size according to new zoomLevel.
function changeCoord() {
    OK.removeEventListener("click", myFunction)
    let resolution = map.getView().getResolution()
    widthP = Math.min(parseInt(getComputedStyle(sizer).getPropertyValue('width')) / 600);
    latInc = Inc * resolution * widthP
    RAD = radC * widthP
    clearM()
    const coords = map.getView().getCenter()
    let yy = map.getView().getCenter()[0]
    while (yy < 180) {
        yy += 360
    }
    while (yy > 180) {
        yy -= 360
    }
    lat = coords[1]
    lon = yy
    //Current map zoom level.
    z = map.getView().getZoom()
    const locUrl = "https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=" + lat + "&lon=" + lon + "&zoom=" + Math.round(z)
    fetch(locUrl)
        .then(function (response) {
            return response.json()
        })
        .then(function (data) {
            try {
                //Extract city at map's zoom level.
                city = city.substring(0, city.indexOf(","))
                city = data.display_name.substring(data.display_name.indexOf(",") + 1)
                if (city == "") {
                    city = "Unnamed location"
                }
            }
            catch {
                city = "Unnamed location"
            }
            try {
                //Extract zip if present.
                const matches = data.display_name.match(/\b\d{5}\b/g)
                //Checks if zip is found.
                if (matches) {
                    zip = matches[0]
                } else {
                    zip = ""
                }
            }
            catch {
                zip = ""
            }
            locationInput.value = zip
            //Erase previous map and recreate map div.    
            zoomLevel = z
            drawGrid(lat, lon, gridSize, city)
        })
        .catch(function () {
            clearM()
            zoomLevel = z
            drawGrid(lat, lon, gridSize, city)
            city = "???"
            zip = "?????"
            console.log("ERROR: UNABLE TO CHANGE LOCATION")
        })
}
//Clears last map and creates new map div for new search.
function clearM() {
    disp.children[0].remove()
    const m = document.createElement("div")
    m.setAttribute("class", "map")
    m.setAttribute("id", "map")
    disp.append(m)
}
//Displays searches in HTML element.
function displaySearches(index) {
    if (index == 0) {
        PREV.setAttribute("style", "display:none")
    }
    else {
        PREV.setAttribute("style", "display:inline")
    }
    if (storedSearches[0].length - index < 4) {
        let w = 0
        for (let v = index; v < storedSearches[0].length; v++) {
            HDISP.children[w].children[0].innerHTML = storedSearches[0][v]
            HDISP.children[w].children[1].innerHTML = storedSearches[1][v]
            w++
        }
        NEXT.setAttribute("style", "display: none")
    }
    else {
        let w = 0
        for (let v = index; v < index + 3; v++) {
            HDISP.children[w].children[0].innerHTML = storedSearches[0][v]
            HDISP.children[w].children[1].innerHTML = storedSearches[1][v]
            w++
        }
        NEXT.setAttribute("style", "display: inline")

    }
    if (storedSearches[0].length == 0) {
        ERASE.setAttribute("style", "display: none")
    }
    else {
        ERASE.setAttribute("style", "display: inline")
    }
}
//See past search history.
function seePrev() {
    fs -= 3
    eraseSearchDisplay()
    displaySearches(fs)
}
//See latest search history.
function seeNext() {
    fs += 3
    eraseSearchDisplay()
    displaySearches(fs)
}
//Erases search history.
function eraseSearches() {
    storedSearches = [[], []]
    //erase stored scoreboard
    localStorage.clear()
    eraseSearchDisplay()
    return
}
//Updates 'Previous Searches' HTML element to display different searches.
function eraseSearchDisplay() {
    ERASE.setAttribute("style", "display: none")
    NEXT.setAttribute("style", "display: none")
    PREV.setAttribute("style", "display:none")
    for (let v = 0; v < 3; v++) {
        HDISP.children[v].children[0].textContent = ""
        HDISP.children[v].children[1].textContent = ""
    }
}
