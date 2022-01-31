

const AQkey = "03e6687524e359bbf0987c0f2ede90cb945e4404";//API key for pollution data
const ipUrl = 'https://ipapi.co/json/';//url for getting lat lon and zip using present ip

//location constiables
let lon;
let lat;
let zip;
let city;
const gridSize = 9;//width and height of grid, !! must be odd !!

//pollution constiables
const pollTypes = ["pm25", "no2", "co", "so2", "nh3", "o3", "pm10"];

//map constiables
const ourZoom = 3;
//these three must change with zoom, or first two musy change when user changes zoom
const lonInc = .2 * ourZoom;//increments of lat lon degrees for the grid (set to be roughly equal in USA)
const latInc = .16 * ourZoom;
const zoomLevel = 8.5 / (ourZoom / 2.4);//this isn't right////////////////////////////////////////////////////////////////////////////////!!



let features;
let map;
let vectorSource;
let vectorLayer;
//p in drawGrid loop function is to enumerate the points on the grid:
/*678
  345
  012*/


//DOM constiables
const llTitle = document.getElementById("levelsTitle");
const llContent = document.getElementById("levelsContent");
const locZip = document.getElementById("enterZip");
locZip.value = "";

//buttons
const OK = document.getElementById("ok");
OK.addEventListener("click", changeZip);
const HERE = document.getElementById("here");
HERE.addEventListener("click", changeCoord);




start();


//launches when page loads, get location from IP and draw map
function start() {
    fetch(ipUrl).then(function (response) {
        return response.json();
    }).then(function (data) {
        if (data.latitude && data.longitude) {//check that this ip returns a geo location
            lat = data.latitude;
            lon = data.longitude;
            if (data.city) {
                city = data.city;
            } else {
                city = "Unnamed location"
            }
            if (data.postal) {
                zip = data.postal;
            } else {
                zip = "00000"
            }
        } else {//if this ip does not return a geo location give Beverly Hills because why not
            lat = 34.07440;
            lon = -117.40499;
            zip = "90210";
            city = "Beverley Hills";
        }
        locZip.value = zip;
        drawGrid(lat, lon, gridSize, city);
    }).catch(function () {
        console.log("Nooo");
    });
}

function drawGrid(lati, lonj, s, City) { //s is width and height of grid
    half = s / 2 - .5; //number of points on each side of central point
    features = [];
    let p = 0;
    let n = 0;

    for (let i = 0; i < s; i++) {
        for (let j = 0; j < s; j++) {



            let la = lati - half * latInc + i * latInc
            let lo = lonj - half * lonInc + j * lonInc

            features.push(new ol.Feature({
                geometry: new ol.geom.Point(ol.proj.fromLonLat([lo, la]))//describes a grid centered at lati lonj
            }));

            pollutionUrl = "https://api.waqi.info/feed/geo:" + la + ";" + lo + "/?token=" + AQkey

            fetch(pollutionUrl).then(function (response) {
                return response.json()
            }).catch(function () {
                console.log("oopsie");
            }).then(function (data) {

                //get pm25 level and set color of point
                if (data.data.iaqi["pm25"].v) {
                    let q = data.data.iaqi["pm25"].v
                    colorStyle = new ol.style.Style({
                        image: new ol.style.Circle({
                            radius: 100,
                            fill: new ol.style.Fill({ color: [Math.min(q * 2, 255), Math.max(255 - q * 2, 0), Math.min(Math.max(0, 2 * (q - 70)), 255)] })//set color with rgb
                        })
                    })
                    features[p].setStyle(function (feature, resolution) {
                        colorStyle.getImage().setScale(map.getView().getResolutionForZoom(10) / resolution)
                        return colorStyle
                    })
                    p++;
                }
                else {
                    features[p].setStyle(new ol.style.Style({
                        image: new ol.style.Circle({
                            radius: 10,
                            fill: new ol.style.Fill({ color: [130, 131, 130] })//set colors to grey if no data
                        })
                    }))
                    p++;
                }
            }).catch(function () {
                console.log("oopsie");///above sometimes not working, don't know why//////////////////////////////////////////////////////////////////////!!!
                ///////////////////////////////////////////////////////////////////////////////////////////////////////////the part below doesn't work idk why!!!
                /*}).then(function(data){
                    if(i==half&&j==half){//if we are at central point display other pollution data if available
                        llTitle.textContent="The pollution levels in " +City+ " are:"
                        let z = 0;
                        for(const potype of pollTypes){
                            if(potype in data.data.iaqi){
    
            
                                llContent.children[z].textContent=potype +": "+data.data.iaqi[potype].v;
                                z++;
                            }
                        }
                    }
                }).catch(function(){
                    console.log("oopsie");*/
            }).then(function () {
                if (i == s - 1 && j == s - 1) {//if we are at final point draw map
                    vectorSource = new ol.source.Vector({
                        features
                    })
                    vectorLayer = new ol.layer.Vector({
                        source: vectorSource,
                        updateWhileAnimating: true,
                        updateWhileInteracting: true,
                        opacity: 0.5,
                    })
                    //draw map centered on given coordinates
                    map = new ol.Map({
                        target: 'map',
                        layers: [
                            new ol.layer.Tile({
                                source: new ol.source.OSM()
                            }), vectorLayer
                        ],
                        view: new ol.View({
                            center: ol.proj.fromLonLat([lonj, lati]),
                            zoom: zoomLevel
                        })
                    });
                }
                const highlightStyle = new ol.style.Style({
                    image: new ol.style.Circle({
                        radius: 30,
                        fill: new ol.style.Fill({
                            color: 'white'
                        })
                    })
                })
                let highlight

                const featureOverlay = new ol.layer.Vector({
                    source: new ol.source.Vector({ highlight }),
                    map: map,
                    updateWhileAnimating: true,
                    updateWhileInteracting: true,
                    style: highlightStyle,
                    opacity: 1,
                    zIndex: 1
                })

                const displayFeatureInfo = function (pixel) {
                    console.log(vectorLayer.getZIndex())
                    vectorLayer.getFeatures(pixel)
                        .then(function (features) {
                            const feature = features.length ? features[0] : undefined
                            const info = document.getElementById('info')
                            if (features.length) {
                                info.innerHTML = 'TEST TEST 123'
                            } else {
                                info.innerHTML = ''
                            }
                            if (feature !== highlight) {
                                if (highlight) {
                                    featureOverlay.getSource().removeFeature(highlight)
                                }
                                if (feature) {
                                    featureOverlay.getSource().addFeature(feature)
                                }
                                highlight = feature
                            }
                        })
                }
                map.on('pointermove', function (evt) {
                    if (evt.dragging) {
                        return
                    }
                    const pixel = map.getEventPixel(evt.originalEvent)
                    displayFeatureInfo(pixel)
                })

                map.on('click', function (evt) {
                    displayFeatureInfo(evt.pixel)
                })


            }).catch(function () {
                console.log("oopsie");
            });

        }
    }
}

//change zip code when user adds zip code and clicks SUMBIT
function changeZip() {

    zip = locZip.value;
    console.log(zip);
    const zipUrl = "https://nominatim.openstreetmap.org/search?postalcode=" + zip + "&country=USA&format=json"
    console.log(zipUrl);

    fetch(zipUrl).then(function (response) {
        return response.json();
    }).then(function (data) {
        console.log(data);
        lat = data[0].lat;
        lon = data[0].lon;
        city = data[0].display_name.substring(0, data[0].display_name.indexOf(","))
        console.log(city);
        clear();
        drawGrid(lat, lon, gridSize, city);
    }).catch(function () {
        zip = "enter valid zip";
        locZip.value = "";
        locZip.placeholder = zip;
    });
}


function changeCoord() {
    const coords = ol.proj.transform(map.getView().getCenter(), 'EPSG:3857', 'EPSG:4326')
    lat = coords[1]
    lon = coords[0]
    console.log("lon= " + lon);
    console.log("lat= " + lat);
    z = 16;///////////////////////////////////////////////////////////change this if we keep the zoom level
    const locUrl = "https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=" + lat + "&lon=" + lon + "&zoom=" + z
    fetch(locUrl).then(function (response) {
        return response.json();
    }).then(function (data) {
        console.log(data);
        city = data.display_name.substring(data.display_name.indexOf(",") + 1);//extract city, at this zoom level(16)it is second 
        city = city.substring(0, city.indexOf(","));
        const matches = data.display_name.match(/\b\d{5}\b/g);//extract zip if present

        if (matches) {//check if zip found
            zip = matches[0];
        } else {
            zip = "00000";
        }
        locZip.value = zip;
        //erase previous map and recreate map div
        clear();
        drawGrid(lat, lon, gridSize, city);
    }).catch(function () {
        console.log("Noo");
    });


}


function clear() {
    disp.children[0].remove();
    const m = document.createElement("div");
    m.setAttribute("class", "map");
    m.setAttribute("id", "map");
    disp.append(m);
}