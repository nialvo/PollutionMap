//API Key for pollution pull and URL for IP address.
const AQkey = "03e6687524e359bbf0987c0f2ede90cb945e4404"
const ipUrl = 'https://ipapi.co/json/'
//Location declarations.
let lon, lat, zip, city
//width and height of grid, !! must be odd !!
const gridSize = 9
//Available pollution types.
const pollTypes = ["pm25", "no2", "co", "so2", "nh3", "o3", "pm10"]
//Increment
const Inc = 43.6906666666666
//These three must change with zoom, or first two musy change when user changes zoom.
let lonInc
let latInc = .48
let zoomLevel = 7
//Map and styling declarations.
let features, greyFeature, map, vectorSource, vectorLayer, p, selectedFeat, oldStyle
//'p' in drawGrid loop function is to enumerate the points on the grid:
/*678
  345
  012*/
//DOM element declarations.
const overlayContainerEl = document.querySelector('.ol-popup')
const popupInfo = document.querySelector('.ol-popup-closer')
const llTitle = document.getElementById("levelsTitle")
const llContent = document.getElementById("levelsContent")
const locZip = document.getElementById("enterZip")
locZip.value = ""
var disp = document.getElementById("disp");
//Map buttons.
const OK = document.getElementById("ok")
OK.addEventListener("click", changeZip)
//localStorage HTML elements.
var HDISP = document.getElementById("displayedSearches")
var fs = 0;//index of first stored element to display
var PREV = document.getElementById("seePrev")
PREV.addEventListener("click", seePrev)
var NEXT = document.getElementById("seeNext")
NEXT.addEventListener("click", seeNext)
var ERASE = document.getElementById("eraseSearches")
ERASE.addEventListener("click", eraseSearches)

if (localStorage.getItem('place7896') == null) {
    var storedSearches = [[], []];
    for (let v = 0; v < 3; v++) {
        HDISP.children[v].children[0].textContent = "";
        HDISP.children[v].children[1].textContent = "";
    }
    displaySearches(fs)
} else {
    var storedSearches = [JSON.parse(localStorage.place7896), JSON.parse(localStorage.levels7896)];
    displaySearches(fs)
}
//Start the program
start()
//launches when page loads, get location from IP and draw map.
function start() {
    fetch(ipUrl).then(function (response) {
        return response.json()
    }).then(function (data) {
        //Checks if IP returns a geo location.
        if (data.latitude && data.longitude) {
            lat = data.latitude
            lon = data.longitude
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
        locZip.value = zip

        drawGrid(lat, lon, gridSize, city)
    }).catch(function () {
        console.log("ERROR: BAD IP FETCH")
    })
}
//Initial grid draw.
function drawGrid(lati, lonj, s, City) { //'s' is width and height of grid.
    eraseSearchDisplay();
    displaySearches(fs);
    localStorage.place7896 = JSON.stringify(storedSearches[0]);
    localStorage.levels7896 = JSON.stringify(storedSearches[1]);
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
                    z = 0;
                    let sstr = "";
                    for (const potype of pollTypes) {
                        if (potype in data.data.iaqi) {
                            llContent.children[z].textContent = potype + ": " + data.data.iaqi[potype].v
                            sstr = sstr + llContent.children[z].textContent + "  "
                            z++

                        }
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
                        radius: 15,
                        //set color with rgb
                        fill: new ol.style.Fill({
                            color: [Math.min(q * 2, 255), Math.max(255 - q * 2, 0), Math.min(Math.max(0, 2 * (q - 70)), 255)]
                        })
                    })
                })
                //Applies an id of 'color' to each point with no data.
                let str = "Here:  \n  ";
                for (const ptype of pollTypes) {
                    if (ptype in data.data.iaqi) {
                        str = str + ptype + ": " + data.data.iaqi[ptype].v + "   \n  ";
                    }
                }
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
                            radius: 15,
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
                        let T
                        function dragTrig() {
                            clearTimeout(T)
                            T = setTimeout(changeCoord, 750)
                        }
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
                        let highlight
                        //On hit detection of feature, append info to info.innerHTML.
                        const displayFeatureInfo = function (pixel) {
                            vectorLayer.getFeatures(pixel)
                                .then(function (features) {
                                    const feature = features.length ? features[0] : undefined
                                    if (feature !== highlight) {
                                        if (highlight) {
                                            popupInfo.innerHTML = ''
                                            overlayContainerEl.setAttribute("style", "visibility:hidden")
                                        }
                                        if (feature) {
                                            overlayContainerEl.setAttribute("style", "visibility:visible")
                                        }
                                        highlight = feature
                                    }
                                })
                        }
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
                                        radius: 15,
                                        fill: new ol.style.Fill({
                                            color: [200, 100, 50, 100]
                                        }),
                                        stroke: new ol.style.Stroke({
                                            color: '#0000e6',
                                            width: 3
                                        })
                                    })
                                })
                                //Sets circle color to highlighted version of current color.                             
                                feature.setStyle(function (feature, resolution) {
                                    highlightStyle.getImage().getFill().setColor(pixelAtCoords)
                                    highlightStyle.getImage().setScale(map.getView().getResolutionForZoom(zoomLevel) / resolution)
                                    return highlightStyle
                                })
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
                        //Once map is finished rendering, check points to remove points on water.
                        map.once('rendercomplete', function () {
                            for (let each in features) {
                                features[each].getGeometry().transform('EPSG:3857', 'EPSG:4326')
                                let coords = features[each].getGeometry().getCoordinates()
                                if (isWater(coords)) vectorSource.removeFeature(features[each])
                            }
                        })
                        map.getView().on("change:center",dragTrig)
                        map.addOverlay(popup)
                        OK.addEventListener("click", changeZip)
                    }
                })
        }
    }
}
//check to see if feature is on the same blue pixel color as water.
function isWater(coords) {
    const blue = [170, 211, 223]
    var xy = map.getPixelFromCoordinate(coords)
    var canvasContext = document.querySelector('canvas').getContext('2d')
    let width = 9, height = 9
    let not_blues = 0
    const startX = xy[0] - Math.floor(width / 2)
    const startY = xy[1] - Math.floor(height / 2)
    for (let vert = 0; vert < height; vert+=8) {
        for (let hor = 0; hor < width; hor+=8) {
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
    return not_blues < 3
}
//change zip code when user adds zip code and clicks SUMBIT
function changeZip() {
    OK.removeEventListener("click", changeZip)
    let resolution = map.getView().getResolution()
    latInc = Inc * resolution
    zoomLevel = map.getView().getZoom()
    clearM()
    zip = locZip.value
    const zipUrl = "https://nominatim.openstreetmap.org/search?postalcode=" + zip + "&country=USA&format=json"
    fetch(zipUrl).then(function (response) {
        return response.json()
    }).then(function (data) {
        lat = data[0].lat
        lon = data[0].lon
        try {
            city = data[0].display_name.substring(0, data[0].display_name.indexOf(","))
            if (city == "") {
                city = "Unnamed location"
            }
        } catch {
            city = "Unnamed location"
        }
        drawGrid(lat, lon, gridSize, city)
    }).catch(function () {
        zip = "enter valid zip"
        locZip.value = ""
        locZip.placeholder = zip
    })
}
//Changes central coordinates to current center of map, and changes feature size according to new zoomLevel.
function changeCoord() {
    OK.removeEventListener("click", changeZip)
    let resolution = map.getView().getResolution()
    latInc = Inc * resolution
    clearM()
    const coords = map.getView().getCenter()
    lat = coords[1]
    lon = coords[0]
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
                    zip = "?????"
                }
            }
            catch {
                zip = "?????"
            }
            locZip.value = zip
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
        PREV.setAttribute("style", "visibility:hidden")
    }
    else {
        PREV.setAttribute("style", "visibility:visible")
    }

    if (storedSearches[0].length - index < 4) {
        let w = 0
        for (let v = index; v < storedSearches[0].length; v++) {
            HDISP.children[w].children[0].textContent = storedSearches[0][v]
            HDISP.children[w].children[1].textContent = storedSearches[1][v]
            w++
        }
        NEXT.setAttribute("style", "visibility:hidden")
    }
    else {
        let w = 0
        for (let v = index; v < index + 3; v++) {
            HDISP.children[w].children[0].textContent = storedSearches[0][v]
            HDISP.children[w].children[1].textContent = storedSearches[1][v]
            w++
        }
        NEXT.setAttribute("style", "visibility:visible")

    }
    if (storedSearches[0].length == 0) {
        ERASE.setAttribute("style", "visibility:hidden")
    }
    else {
        ERASE.setAttribute("style", "visibility:visible")
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
    ERASE.setAttribute("style", "visibility:hidden")
    NEXT.setAttribute("style", "visibility:hidden")
    PREV.setAttribute("style", "visibility:hidden")
    for (let v = 0; v < 3; v++) {
        HDISP.children[v].children[0].textContent = ""
        HDISP.children[v].children[1].textContent = ""
    }
}