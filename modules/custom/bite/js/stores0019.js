(function ($, Drupal, drupalSettings) {

    Date.prototype.toISODate = function() {
      return this.getFullYear() + '-' + ('0'+ (this.getMonth()+1)).slice(-2) + '-' + ('0'+ this.getDate()).slice(-2);
    }

    let themeColor = '#00AA14';
    let markerIcon = drupalSettings.path.themeUrl + '/images/icons/map-cluster-icon-lt.svg';
    let markerWidth = 40;
    let markerHeight = 40;
    let userMarkerIcon = drupalSettings.path.themeUrl + '/images/icons/icon-store-map-user-lt.svg';

    Drupal.behaviors.StoreMap = {
        attach: function attach(context) {
            var weekdays = [
                '1',
                '2',
                '3',
                '4',
                '5',
                '6',
                '0'
            ];

            var nameTimes = {
                '0': Drupal.t('Sun:'),
                '1': Drupal.t('Mon:'),
                '2': Drupal.t('Tue:'),
                '3': Drupal.t('Wed:'),
                '4': Drupal.t('Thu:'),
                '5': Drupal.t('Fri:'),
                '6': Drupal.t('Sat:')
            };

            // State
            let activeMarker = null;
            let origin = null;

            // Views
            let $mapWrapper = $('.store-map__container', context).once('store-map');
            let $listContainer = $('.store-map-list', context).once('store-map');
            let $mapContainer = $('.store-map-container', context).once('store-map');
            if (!$mapContainer.length) return;

            // View controls
            let $viewChoice = $('#map-view-choice', context);

            let $mapControl = $viewChoice.find('#map-view-choice__map');
            let $listControl = $viewChoice.find('#map-view-choice__list');
            let $infoBoxFooter = $('.store-map__footer', context).once('store-map').get(0);
            let $infoBoxFooterContent = $('.store-map__footer__content', context).once('store-map').get(0);

            // Map store info
            let $sidebarInfo = $('#store-sidebar-info', context);

            // Search and location functionality
            let $locationBox = $('#store-map-route', context);

            let $searchField = $locationBox.find('#map-search');
            let $locateUserButton = $locationBox.find('.js-store-map-route-icon');

            let autoComplete = new google.maps.places.Autocomplete($searchField.once('store-map').get(0));

            let $directionsPanel = $mapWrapper.find('.store-map__route__path');

            let geocoder = new google.maps.Geocoder();
            // Directions
            let directionsService = new google.maps.DirectionsService();
            let directionsDisplay = new google.maps.DirectionsRenderer(getDirectionsRendererOptions());

            // Map options
            let mapOptions = {
                mapTypeId: google.maps.MapTypeId.ROADMAP,
                center: { lat: 56.9574059, lng: 24.065855 },
                zoom: 12,
                gestureHandling: 'greedy',
                clickableIcons: true,
                disableDefaultUI: true,
            }

            if (drupalSettings.themeType == 'lt') {
                mapOptions.center = { lat: 54.684996, lng: 25.2757053 }
            }

            populateIconBar();

            let map = new google.maps.Map($mapContainer.get(0), mapOptions);
            let infoBox = new InfoBox();

            directionsDisplay.setMap(map);

            let stores = createAllStores();
            let holidays = drupalSettings.retailStores.holidays
            let markers = createMarkers();
            let markerClusterer = createMarkerClusterer();

            google.maps.event.addListener(markerClusterer, 'click', fitBoundsWithSidebar);

            zoomControl(map);

            setupPlaceChangedListener();

            populateListView();

            populateServicesInput();

            function createMarkers() {
                let markers = [];
                let markerOptions = {
                    icon: getBiteIcon(),
                    shape: getBiteIconShape(),
                    category: stores.amenities,
                    map: map
                };

                for (let i = 0; i < stores.length; i++) {
                    let store = stores[i];
                    let storeAmenities = [];

                    store.amenities.forEach(function (key) {
                        storeAmenities.push(key);
                    });

                    markerOptions.position = store.position;
                    markerOptions.category = storeAmenities;

                    let marker = new google.maps.Marker(markerOptions);

                    marker.storeID = i;

                    markers.push(marker);
                    google.maps.event.addListener(marker, 'click', ((marker, i) => {
                        return () => {
                            activeMarker = markers[i];

                            hideCityFilter();
                            hideMapFilter();

                            for (let j in markers) {
                                if (markers.hasOwnProperty(j)) {
                                    markers[j].setVisible(true);
                                }
                            }

                            if (innerWidth > 993) {
                                infoBox.setOptions(getInfoBoxOptions());
                                infoBox.setContent(getStoreMarkerInfo(i));
                                infoBox.open(map, marker);
                                marker.setVisible(false);
                            } else {
                                map.setCenter(marker.getPosition());
                                $infoBoxFooter.classList.add('is-active');
                                $infoBoxFooterContent.innerHTML = getStoreMarkerInfo(i);
                            }
                        }
                    })(marker, i));
                }

                return markers;
            }

            function fitBoundsWithSidebar(cluster) {
                let bounds = cluster.getBounds();
                let padding = {};

                if ($(window).width() < 993) {
                    padding = { bottom: 50, top: 50, left: 50, right: 50 };
                } else {
                    padding = { right: 380, left: 200, top: 200, bottom: 200 };
                }

                map.fitBounds(bounds, padding);
            }

            function getBiteIcon(scale = 1) {
                return icon = {
                    size: new google.maps.Size(markerWidth, markerHeight),
                    scaledSize: new google.maps.Size(markerWidth * scale, markerHeight * scale),
                    origin: new google.maps.Point(0, 0),
                    anchor: new google.maps.Point((markerWidth * scale - 1) / 2, (markerHeight * scale - 1) / 2),
                    url: markerIcon
                };
            }

            function getBiteIconShape() {
                return shape = {
                    coords: [19, 51, 7, 39, 0, 23, 0, 16, 5, 7, 14, 1, 22, 1, 33, 7, 37, 16, 37, 23, 30, 39, 19, 51],
                    type: 'poly'
                };
            }

            function getDirectionsRendererOptions() {
                return options = {
                    suppressInfoWindows: true,
                    suppressMarkers: true,
                    polylineOptions: {
                        strokeColor: themeColor,
                        strokeOpacity: 0.5,
                        strokeWeight: 4
                    }
                };
            }

            function setupPlaceChangedListener() {
                autoComplete.bindTo('bounds', map);
                autoComplete.addListener('place_changed', () => {
                    let place = autoComplete.getPlace();

                    // kill user marker
                    for (let i = 0; i < markers.length; i++) {
                        if (markers[i].category === 'userLocation') {
                            markers[i].setMap(null);
                        }
                    }
                    // set new user marker
                    let marker = new google.maps.Marker({
                        position: place.geometry.location,
                        category: 'userLocation',
                        map: map,
                        icon: userMarkerIcon,
                    });
                    markers.push(marker);

                    if (place.name.trim().toLowerCase() === "Your location") {
                        getUserLocation();
                        return;
                    } else if (!place.place_id) {
                        return;
                    } else {
                        setOrigin(place, false);
                    }

                    if ($locationBox.hasClass('expanded')) {
                        calculateRoute();
                    } else {
                        centerOrigin();
                    }
                });
            }

            function handleGeolocationSuccess(position) {
                let pos = new google.maps.LatLng({
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                });

                $searchField.attr('value', '*').val('Your location');
                setOrigin(pos, false);
                $locateUserButton.removeClass('locating');

                if ($locationBox.hasClass('expanded')) {
                    calculateRoute();
                } else {
                    centerOrigin();
                }
            }

            function handleGeolocationFailure() {
                $searchField.attr('value', '*').val(Drupal.t('Geolocation failed'));
                $locateUserButton.removeClass('locating');
            }

            function getUserLocation() {
                if (!navigator.geolocation) {
                    $locateUserButton.addClass('disabled');
                    $searchField.attr('value', '*').val(Drupal.t('Geolocation failed'));
                } else {
                    $locateUserButton.removeClass('disabled').addClass('locating');
                    $searchField.attr('value', '*').val('Locating...');
                    navigator.geolocation.getCurrentPosition(
                        (position) => {
                            // kill user marker
                            for (let i = 0; i < markers.length; i++) {
                                if (markers[i].category === 'userLocation') {
                                    markers[i].setMap(null);
                                }
                            }

                            // set new user marker
                            let marker = new google.maps.Marker({
                                position: {
                                    lat: position.coords.latitude,
                                    lng: position.coords.longitude
                                },
                                category: 'userLocation',
                                map: map,
                                icon: userMarkerIcon,
                            });
                            markers.push(marker);

                            handleGeolocationSuccess(position);
                        },
                        () => {
                            handleGeolocationFailure();
                        },
                        {
                            maximumAge: 0,
                            timeout: 6000
                        });
                }
            }

            function setOrigin(orig, centerOrigin = false) {
                origin = orig;

                if (centerOrigin) {
                    centerOrigin();
                }
            }

            function centerOrigin() {
                if (!origin) {
                    return;
                }

                let position = origin.geometry ? origin.geometry.location : origin;
                map.setCenter(position);
                showNearbyStores(position);
            }

            function closeDetailedInfo() {
                $sidebarInfo.removeClass('expanded').hide();
            }

            function openDetailedInfo() {
                $sidebarInfo.addClass('expanded').show();
            }

            function setDetailedInfo(storeIndex, container) {
                let store = stores[storeIndex];
                let iconBar = container.find('.store-map-info__icon__bar');
                let times = container.find('.store-map-info__times');

                // add store coords
                container.attr({
                    'data-lat': store.position.lat,
                    'data-lng': store.position.lng
                });

                if ($('.store-map-info__container').hasClass('expanded')) {
                    // Hide open times list
                    closeTimeList();
                }

                // Set address
                const title = store.title ? `${ store.title }, ${ store.address }` : store.address;
                container.find('.store-map-info__title').text(title);

                // Hide all icons from bar
                iconBar.find('[class*="store-map-info__icon--"]').addClass('is-hide');
                // Show icons that the store has
                store.amenities.map((amenity, index) => {
                    iconBar.find(`.store-map-info__icon--${amenity.id}`).removeClass('is-hide').attr('data-content', amenity.label);
                });

                // Set phone nr
                  if (store.phone) {
                    container.find('.store-map-info__phone__text').text(store.phone).attr('href', `tel:${store.phone}`);

                  } else {
                    container.find('.store-map-info__phone__text').addClass('d-none');

                  }

              if (store.phoneBusiness) {
                container.find('.store-map-info__phone__business .store-map-info__phone__text').text(store.phoneBusiness).attr('href', `tel:${store.phoneBusiness}`);
              } else {
                container.find('.store-map-info__phone__business').addClass('d-none');
              }

                let openTodayInfo = getOpenNowInfo(store);
                setStoreInfoTimes(times, openTodayInfo.dataName, openTodayInfo.timesToday, openTodayInfo.timeList, openTodayInfo.breakTimeList, openTodayInfo.detailedTime);
            }

            function getInfoBoxOptions() {
                let options = {
                    boxClass: 'store-map__about__container',
                    closeBoxURL: '',
                    alignBottom: true,
                    pixelOffset: new google.maps.Size(-20, 6),
                    pane: 'mapPane',
                    disableAutoPan: false, // Handled by offsetting window
                    infoBoxClearance: new google.maps.Size(50, 50), // Padding from map edge
                    enableEventPropagation: true,
                };

                return options;
            }

            // Navigate for native maps
            function navigate($target) {
                let $parent = $target.closest('[data-lat]');
                let lat = $parent.data('lat');
                let lng = $parent.data('lng');
                // If it an iPhone..
                if ((navigator.platform.indexOf("iPhone") !== -1) || (navigator.platform.indexOf("iPod") !== -1)) {
                    function iOSversion() {
                        if (/iP(hone|od|ad)/.test(navigator.platform)) {
                            // supports iOS 2.0 and later: <http://bit.ly/TJjs1V>
                            var v = (navigator.appVersion).match(/OS (\d+)_(\d+)_?(\d+)?/);
                            return [parseInt(v[1], 10), parseInt(v[2], 10), parseInt(v[3] || 0, 10)];
                        }
                    }
                    var ver = iOSversion() || [0];

                    if (ver[0] >= 6) {
                        protocol = 'maps://';
                    } else {
                        protocol = 'http://';

                    }
                    window.location = `${protocol}maps.apple.com/maps?daddr=${lat},${lng}&amp;ll=${lat},${lng}`;
                }
                else {
                    window.open(`http://maps.google.com?daddr=${lat},${lng}&amp;ll=${lat},${lng}`);
                }
            }

            function getStoreMarkerInfo(storeIndex) {
                let store = stores[storeIndex];

                let times = [];
                let breakTimes = [];
                for (let i in store.openTimes) {
                    if (store.openTimes.hasOwnProperty(i)) {
                        let time = store.openTimes[i];

                        if (time && time.length === 0) {
                            time = store.specialConditions[i];

                            times.push(`<li class="store-map__about__info__times__day">
                              <b>${nameTimes[i]}</b>
                              <span>${time}</span>
                          </li>`);
                        } else {
                            times.push(`<li class="store-map__about__info__times__day">
                              <b>${nameTimes[i]}</b>
                              <span>${time ? `${time[0]} - ${time[1]}` : Drupal.t('Closed')}</span>
                          </li>`);
                        }
                    }
                }

                let timeList = weekdays.map((day) => {
                    return times[day];
                });

                for (let i in store.breakTimes) {
                    let time = store.breakTimes[i];

                    breakTimes.push(`<li class="store-map__about__info__times__day store-map__about__info__times__day--break">
                        <b>${breakTime}</b>
                        <span>${time ? `${time[0]} - ${time[1]}` : 'Closed'}</span>
                    </li>`);
                }

                let infoButton = `<a tabindex="0" class="btn btn-default btn-gray store-map-info__directions__link js-store-map-info-direction-link" role="button">${Drupal.t('Get directions')}</a>`;

                if (drupalSettings.themeType == 'lt') {
                    infoButton = `<a tabindex="0" class="btn btn-default btn-primary btn--bordered store-map-info__directions__link js-store-map-info-direction-link" role="button">${Drupal.t('Get directions')}</a>`;
                }

                let infoContent = `
          <div class="store-map__about" role="dialog" data-lat="${store.position.lat}" data-lng="${store.position.lng}">
            <button class="store-map__about__close js-store-map-about-close store-map__close-icon" type="button">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M13 1L1 13" stroke="${ themeColor }" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                    <path d="M13 13L1 0.999999" stroke="${ themeColor }" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
            </button>
            <div class="store-map__about__top">
                <div class="store-map__about__title" tabindex="-1">${
                    store.title ? `${ store.address }<small>${ store.address }</small>` : store.address
                    }</div>
                ${ store.amenities.length ? `
                    <ul class="store-map__about__info__icon__bar">
                        ${store.amenities.map((amenity) => {
                    return `<li class="store-map__about__info__icon js-store-map-get-info store-map__about__info__icon--${amenity.id}" data-content="${amenity.label}" data-placement="bottom">
                                        <img width="28" height="28" src="${amenity.icon_path}">
                                        <span>${amenity.label}</span>

                                    </li>`
                }).join('')}
                    </ul>
                ` : '' }
            </div>
            <div class="store-map__about__slider"><div class="store-map__about__bottom">
              <div class="store-map__about__bottom__left">
                <ul class="store-map__about__info__times__list">
                  ${timeList.join('')}
                </ul>
              </div>
              <div class="store-map__about__bottom__right">
                ${ breakTimes.length ? `
                    <ul class="store-map__about__info__times__list">
                        ${breakTimes.join('')}
                    </ul>` : ''}
                <a class="store-map__about__phone__text ${store.phone ? '' : 'd-none'}" href="tel:${store.phone}">${store.phone}</a>
                <div class="store-map__about__phone__business ${store.phoneBusiness ? '' : 'd-none'}">
                  <span>${Drupal.t('Business phone')}.</span>
                  <a class="store-map__about__phone__text" href="tel:${store.phoneBusiness}">${store.phoneBusiness}</a>
                </div>
                <button class="store-map-info__directions js-store-map-about-directions" type="button">${Drupal.t('Get directions')}</button>
              </div>
              ${ infoButton }
            </div></div>
          </div>
        `;

                return infoContent;
            }

            function openTimeList(event) {
                hideMapFilter();
                hideCityFilter();

                let $timeList = $mapWrapper.find('.store-map-info__times__list').find('ul');

                if (event) {
                    $timeList = $timeList.add($(event.target).closest('.store-map-info__container'));
                } else {
                    $timeList = $timeList.add($(`#${activeMarker.storeID}`));
                }

                // close other
                $('.store-map-info__container').find('.store-map-info__hide').hide();
                $('.store-map-info__container').removeClass('expanded');
                $('.store-map-info__container')
                    .find('.store-map-info__icon__arrow')
                    .removeClass('store-map-info__icon__arrow--up')
                    .addClass('store-map-info__icon__arrow--down');

                // open this
                $timeList
                    .find('.store-map-info__icon__arrow')
                    .removeClass('store-map-info__icon__arrow--down')
                    .addClass('store-map-info__icon__arrow--up');
                $timeList.find('.store-map-info__hide').show();
                $timeList.addClass('expanded');

                if ($(window).width() > 992) {
                    let latMap = $timeList.data('lat');
                    let lngMap = $timeList.data('lng');

                    let mapStore = new google.maps.Map($timeList.find('.store-map-info__more__map').get(0), {
                        center: { lat: latMap, lng: lngMap },
                        mapTypeId: 'roadmap',
                        zoom: 13,
                        gestureHandling: 'cooperative',
                        disableDefaultUI: true,
                    });

                    let marker = new google.maps.Marker({
                        position: { lat: latMap, lng: lngMap },
                        map: mapStore,
                        icon: markerIcon
                    });
                } else {
                    $('.store-map-info__icon__bar').css({
                        display: 'none',
                    });
                    $timeList.find('.store-map-info__icon__bar').css({
                        display: drupalSettings.themeType == 'lv' ? 'flex' : 'block',
                    });

                    // Scroll to item
                    const itemPosition = $timeList.offset().top - 56; // 56 - size of the header
                    const scrollPosition = $(window).scrollTop();

                    if (itemPosition < scrollPosition) {
                        $('html,body').animate({
                            scrollTop: itemPosition
                        }, 300);
                    }
                }
            }

            function closeTimeList() {
                let timeList = $('.store-map-info__container');

                if (!timeList.hasClass('expanded')) {
                    return false;
                }

                let hideContainer = timeList.find('.store-map-info__hide');

                timeList.find('.store-map-info__icon__arrow').addClass('store-map-info__icon__arrow--down').removeClass('store-map-info__icon__arrow--up');
                hideContainer.hide();
                timeList.removeClass('expanded');

                if ($(window).width() < 993) {
                    $('.store-map-info__icon__bar').css({
                        display: 'none',
                    });
                }

                closeInfoBox();
                activeMarker = null;
            }

            function getOpenNowInfo(store) {
                let openTimes = store.openTimes;
                let breakTimes = store.breakTimes;
                let specialConditions = store.specialConditions;

                // modify openTimes depending on holidays
                let dateWorker = new Date();

                for (let i = 0; i < 7; i++) {
                  let worker_weekday = dateWorker.getDay().toString();
                  let date = dateWorker.toISODate();
                  if (typeof holidays[date] != 'undefined' && typeof holidays[date].stores[store.id] != 'undefined') {
                    openTimes[worker_weekday] = holidays[date].stores[store.id];
                  }

                  dateWorker.setDate(dateWorker.getDate() + 1);
                }

                let now = new Date();
                let weekday = now.getDay().toString();
                let storeOpenToday = openTimes[weekday];
                let dataName, timesToday, detailedTime;

                if (storeOpenToday && storeOpenToday.length) {
                    let opensAt = parseTimeString(storeOpenToday[0]);
                    let closesAt = parseTimeString(storeOpenToday[1]);

                    let opening = new Date();
                    opening.setHours(opensAt[0]);
                    opening.setMinutes(opensAt[1]);

                    let closing = new Date();
                    closing.setHours(closesAt[0]);
                    closing.setMinutes(closesAt[1]);

                    timesToday = `${storeOpenToday[0]} - ${storeOpenToday[1]}`;

                    if (now < opening) {
                        // before-opening
                        dataName = 'closed';
                        if (innerWidth <= 992) {
                            detailedTime = Drupal.t('until') + ` ${storeOpenToday[0]}`;
                        } else {
                            detailedTime = `${storeOpenToday[0]} - ${storeOpenToday[1]}`;
                        }
                    } else if (now > opening && now < closing) {
                        // open
                        dataName = 'open';
                        if (innerWidth <= 992) {
                            detailedTime = Drupal.t('until') + ` ${storeOpenToday[1]}`;
                        } else {
                            detailedTime = `${storeOpenToday[0]} - ${storeOpenToday[1]}`;;
                        }
                    } else {
                        // after-closing
                        dataName = 'closed';
                        if (innerWidth <= 992) {
                            detailedTime = Drupal.t('until') + ` ${storeOpenToday[0]}`;
                        } else {
                            detailedTime = `${storeOpenToday[0]} - ${storeOpenToday[1]}`;
                        }
                    }

                } else {
                    timesToday = '';
                    dataName = 'closed';
                }

                let timeList = weekdays.map((day) => {
                    let time;

                    if (openTimes[day] && openTimes[day].length > 0) {
                        time = `${openTimes[day][0]} - ${openTimes[day][1]}`;
                    } else {

                        if (specialConditions[day] !== undefined) {
                            time = specialConditions[day];
                        } else {
                            time = Drupal.t('Closed');
                        }
                    }

                    return [remapWeekdayName(day), time];
                });

                let breakTimeList = breakTimes.map((breakTime) => {
                    return `${breakTime[0]} - ${breakTime[1]}`
                });

                return {
                    dataName: dataName,
                    timesToday: timesToday,
                    timeList: timeList,
                    breakTimeList: breakTimeList,
                    detailedTime: detailedTime
                }
            }

            function setStoreInfoTimes(container, dataName, timesToday, timeList, breakTimeList, detailedTime) {
                let detailedHeading = container.closest('.store-map-info__container').find('.store-map-info__times--detailed');

                detailedHeading.html(`${detailedHeading.data(dataName)} ${detailedTime ? `<span>${detailedTime}</span>` : `${timesToday ? `<span>${timesToday}</span>` : ''}`}`);

                if (dataName === 'closed') {
                    detailedHeading.addClass('is-closed');
                }

                let weekList = container.closest('.store-map-info__container').find('.js-store-map-time-day');

                weekList.map((i, e) => {
                    let content = timeList.shift();

                    $(e).children().eq(0).text(content[0]);
                    $(e).children().eq(1).text(content[1])
                });

                let breakList = container.closest('.store-map-info__container').find('.js-store-map-time-break');

                breakList.map((index, element) => {
                    let content = breakTimeList.shift();
                    $(element).children().eq(1).text(content);
                });
            }

            function createMarkerClusterer() {
                let clusterStyle = {
                    anchorText: [-16, 32],
                    fontFamily: 'inherit',
                    fontWeight: '400',
                    textSize: 14,
                    textHeight: 24,
                    textColor: themeColor,
                    width: markerWidth,
                    height: markerHeight,
                    url: markerIcon
                };

                let clustererOptions = {
                    averageCenter: true,
                    clusterClass: 'store-map__pin store-map__pin--clustered',
                    styles: [clusterStyle, clusterStyle, clusterStyle, clusterStyle, clusterStyle],
                    zoomOnClick: false
                };

                let markerClusterer = new MarkerClusterer(map, markers, clustererOptions);

                return markerClusterer;
            }

            function switchToMapView() {
                let activeMarkerFake = activeMarker;

                closeTimeList();

                if (activeMarkerFake) {
                    map.setCenter(activeMarkerFake.getPosition());
                    map.setZoom(15);
                    google.maps.event.trigger(activeMarkerFake, 'click');
                }

                $mapWrapper.removeClass('list-view');
                $mapContainer.removeClass('inactive')
                $listContainer.addClass('inactive');
                $listControl.removeClass('is-active');
                $mapControl.addClass('is-active');

                hideMapFilter();
                hideCityFilter();
            }

            function switchToListView() {
                if ($locationBox.hasClass('expanded')) {
                    closeDirectionsPanel();
                }

                let location = activeMarker
                    ? activeMarker
                    : map.getCenter();

                showNearbyStores(location);

                $listContainer.removeClass('inactive');
                $mapWrapper.addClass('list-view');
                $mapContainer.addClass('inactive')
                $mapControl.removeClass('is-active');
                $listControl.addClass('is-active');

                hideCityFilter();
                hideMapFilter();

                if (activeMarker) {
                    openTimeList();
                    closeInfoBox();
                }
            }

            function populateListView() {
                let template = $listContainer.find('#store-map-info-proto');

                for (let i = 0; i < stores.length; i++) {
                    let storeContainer = template.clone(true).attr('id', i).appendTo($listContainer.find('.store-map-list__row'));

                    setDetailedInfo(i, storeContainer);
                }

              let location = activeMarker
                ? activeMarker
                : map.getCenter();

              showNearbyStores(location);
            }

            function populateIconBar() {
                let iconBar = $listContainer.find('.store-map-info__icon__bar');

                Object.keys(drupalSettings.retailStores.amenities).forEach(function(key) {
                    let amenity = drupalSettings.retailStores.amenities[key];
                    iconBar.append(`
                        <li class=\"store-map-info__icon js-store-map-get-info store-map-info__icon--${amenity.id}\" data-placement=\"bottom\" data-content="${amenity.label}">
                        <img width="28" height="28" src="${amenity.icon_path}">
                        </li>
                        `
                    );
                })


            }

            function populateServicesInput() {
                let $settingsList = $('#storeMapFilter');
                Object.keys(drupalSettings.retailStores.amenities).forEach(function(key) {
                    let amenity = drupalSettings.retailStores.amenities[key];
                    $settingsList.append(`
                        <div class="checkbox">
                            <label>
                                <input class="js-store-map-sidebar-filter-input" id="${amenity.id}" name="${amenity.label}" type="checkbox" value="${amenity.label}"><span></span>${amenity.label}
                            </label>
                        </div>
                        `
                    );
                })
            }


            function showNearbyStores(location) {
                let position = location.icon ? location.getPosition() : location;

                let storeEntries = $listContainer.find('.store-map-list__row').find('.store-map-info__container').not('#store-map-info-proto').addClass('d-none');

                let distancesToStores = [];

                for (let i = 0; i < markers.length; i++) {
                    let marker = markers[i];

                    if (activeMarker && activeMarker.storeID === marker.storeID) {
                        marker.setVisible(true);
                    }

                    if (marker.getVisible()) {
                        distancesToStores.push({ index: i, distance: google.maps.geometry.spherical.computeDistanceBetween(position, marker.getPosition()) });
                    }
                }

                distancesToStores.sort((a, b) => {
                    if (a.distance > b.distance) {
                        return 1;
                    }

                    if (a.distance < b.distance) {
                        return -1;
                    }

                    return 0;
                });

                let sortedStoreIndices = distancesToStores.map((el) => {
                    return el.index
                });

                let order = 1;

                sortedStoreIndices.map((storeIndex) => {
                    storeEntries.eq(storeIndex).removeClass('d-none').css('order', order++);
                });
            }

            function calculateRoute() {
                if (!origin) {
                    return;
                }

                let target = activeMarker.getPosition();
                let request = {
                    origin: origin.geometry ? origin.geometry.location : origin,
                    destination: target,
                    travelMode: 'DRIVING',
                    provideRouteAlternatives: true
                };

                directionsService.route(request, (result, status) => {
                    if (status === 'OK') {
                        handleRouteSuccess(result);
                    } else {
                        console.log('Status: ' + status);
                        $('.store-map__route__path').addClass('cant-routed').html('<div class="store-map__route__path__content">Wrong way</div>');
                    }
                });
            }

            function handleRouteSuccess(result) {
                directionsDisplay.setDirections(result);
                $directionsPanel = $('.store-map__route__path'); // Refresh object after directions added to panel


                setTimeout(function () {
                    prepareSingleRouteHTML(result);
                    $directionsPanel.addClass('expanded');
                }, 200);
            }

            function prepareSingleRouteHTML(result) {
                let summaryDiv = $('.store-map__route__path');

                if (summaryDiv.hasClass('is-routed')) {
                    summaryDiv.html('');
                }

                summaryDiv.removeClass('cant-routed').addClass('is-routed');
                summaryDiv.append(`
            <div class="store-map__route__path__content">
              <p>${ textApproximately } ${result.routes[0].legs[0].duration.text}</p>
              <span>${result.routes[0].legs[0].end_address}</span>
            </div>
            <div class="store-map__route__path__distance">${result.routes[0].legs[0].distance.text}</div>
          `);
            }

            function openDirectionsPanel() {
                let activeStore = stores[activeMarker.storeID];

                let destinationGroup = $locationBox.find('.store-map__route__location__group').eq(1);
                destinationGroup.find('input').attr('value', '*').val(activeStore.address); // .attr is workaround to move label properly

                closeDetailedInfo();
                calculateRoute();

                $locationBox.show().addClass('expanded');
            }

            function closeDirectionsPanel() {
                $locationBox.hide().removeClass('expanded');

                directionsDisplay.set('directions', null);
                $directionsPanel.removeClass('expanded');

                openDetailedInfo();
            }

            function zoomControl(map) {
                let zoomIn = $('#store-map-zoomIn').get(0);
                let zoomOut = $('#store-map-zoomOut').get(0);

                google.maps.event.addDomListener(zoomOut, 'click', function () {
                    let currentZoomLevel = map.getZoom();

                    if (currentZoomLevel !== 0) {
                        map.setZoom(currentZoomLevel - 1);
                    }
                });

                google.maps.event.addDomListener(zoomIn, 'click', function () {
                    let currentZoomLevel = map.getZoom();

                    if (currentZoomLevel !== 21) {
                        map.setZoom(currentZoomLevel + 1);
                    }
                });
            }

            // Google Maps scripts loaded callback
            let mapLibsLoaded = 0;
            function handleMapLibLoaded() {
                mapLibsLoaded++;
                if (mapLibsLoaded < 3) {
                    return;
                }
            }

            handleMapLibLoaded();

            // Parses format hh:mm (string) to [hh, mm] (array of int)
            function parseTimeString(timeString) {
                return timeString.split(':').map((el) => {
                    return parseInt(el, 10);
                });
            }

            function remapWeekdayName(weekday) {
                if (Array.isArray(weekday)) {
                    return weekday.map((weekdayIndex) => {
                        return nameTimes[weekdayIndex]
                    });
                }
                else {
                    return nameTimes[weekday];
                }
            }

            function createStore(location, data) {
                let position = {
                    lat: location.lat,
                    lng: location.lng
                }

                let amenities = [];
                data.amenities.forEach(function (key) {
                    amenities.push(drupalSettings.retailStores.amenities[key]);
                });

                return {
                    id: data.id,
                    title: data.title || '',
                    address: data.address,
                    position: position,
                    amenities: amenities,
                    category: data.category,
                    openTimes: {
                        '1': data.openTimes[1],
                        '2': data.openTimes[2],
                        '3': data.openTimes[3],
                        '4': data.openTimes[4],
                        '5': data.openTimes[5],
                        '6': data.openTimes[6],
                        '0': data.openTimes[0],
                    },
                    specialConditions: {
                        '1': data.specialConditions[1],
                        '2': data.specialConditions[2],
                        '3': data.specialConditions[3],
                        '4': data.specialConditions[4],
                        '5': data.specialConditions[5],
                        '6': data.specialConditions[6],
                        '0': data.specialConditions[0],
                    },
                    breakTimes: data.breakTimes || [],
                    phone: data.phone,
                    phoneBusiness: data.phoneBusiness
                };
            }

            function createAllStores() {
                let stores = [];

                drupalSettings.retailStores.stores.map((data) => {
                    stores.push(createStore(data.position, data));

                });

                return stores;
            }

            function handleDirectionsOpen() {
                switchToMapView();
                openDirectionsPanel();
                closeInfoBox();
                return false;
            }

            function handleDirectionsClose() {
                closeDirectionsPanel();
                openDetailedInfo();
                return false;
            }

            function handleViewChoiceClick(event) {
                let choice = $(event.target);
                if (choice.hasClass('active')) {
                    return false;
                }

                if (choice.is('#map-view-choice__map')) {
                    switchToMapView();

                    if ($(window).width() <= 992) {
                        mapFullScreen();
                    }

                    return false;
                } else if (choice.is('#map-view-choice__list')) {
                    switchToListView();

                    if ($(window).width() <= 992) {
                        mapWithScroll();
                    }

                    return false;
                }
            }

            function handleWholeWeekTimesClick(event) {
                let $this = $(event.target).closest('.store-map-info__container');

                if ($this.find('.store-map-info__icon__arrow').hasClass('store-map-info__icon__arrow--down')) {
                    let storeID = parseInt($this.attr('id'), 10);

                    activeMarker = markers[storeID];

                    openTimeList(event);
                } else if ($this.find('.store-map-info__icon__arrow').hasClass('store-map-info__icon__arrow--up')) {
                    closeTimeList(event);
                } else {
                    return false;
                }
            }

            function handleGeolocationClick() {
                getUserLocation();
            }

            function closeInfoBox() {
                if (innerWidth >= 993) {
                    infoBox.close();
                    $('body').removeClass('scroll-stop');

                    if (activeMarker) {
                        activeMarker.setVisible(true);
                    }
                } else {
                    $('body').removeClass('scroll-stop');
                    $('.store-map__about__slider').slideUp(300);
                    $('.store-map__about').removeClass('is-full');
                    $($infoBoxFooter).removeClass('is-full');
                    $('.store-map__footer__mask').removeClass('is-active');
                    $($infoBoxFooter).removeClass('is-active');
                    $($infoBoxFooterContent).html('');
                }
            }

            function getPopoverOptions(trigger, classes = '', placement = null) {
                let options = {
                    animation: false,
                    container: 'body',
                    template: `<div class="popover ${classes}" role="tooltip"><div class="arrow"></div><div class="popover-content"></div></div>`,
                    trigger: trigger,
                    viewport: { 'selector': 'body', 'padding': 20 }
                };
                if (placement) options['placement'] = placement;
                return options;
            }

            function showPopovers() {
                let $hoverInfo = $(context).find('.js-store-map-get-info').once('store-map');

                if ($(window).width() >= 993) {
                    // Hide mobile popovers
                    $hoverInfo.popover('hide');

                    $hoverInfo.each((i, e) => {
                        let content = $(e).data('content') || $(e).find('[data-content]').data('content');

                        if (content) {
                            $(e)
                                .popover(getPopoverOptions('hover', 'popover--amenity store-map__popover', 'bottom'));
                        }
                    });
                } else if ($('.popover').length) {
                    $hoverInfo.popover('destroy');
                } else {
                    $(context).find('.js-store-map-get-info').popover(getPopoverOptions('manual', 'store-map__popover--centered', 'bottom'));

                    $(document, context).once('store-map')
                        .on('click', '.js-store-map-get-info', (e) => {
                            if ($(window).width() < 993 && !$('.popover').length) {
                                $(e.currentTarget).popover('show');
                                $('.popover').attr('tabindex', 0);

                                if (!$('body').find('.overlay').length) {
                                    $('.popover').before('<div class="overlay" tabindex="0"></div>');
                                }
                                return false;
                            };
                        })
                        .on('click', () => {
                            if ($(window).width() < 993 && $('.popover').length) {
                                $('.popover').remove();
                                $('.overlay').remove();
                            }
                        })
                }
            }

            showPopovers();

            function hideCityFilter() {
                $('.js-store-map-sidebar-city').find('.select').removeClass('active');
                $('.js-store-map-sidebar-city').find('.select-styled').removeClass('active');
                $('.js-store-map-sidebar-city').find('.select-options').fadeOut(200);
                $('.js-store-map-sidebar-city').find('input').addClass('is-hidden');
            }

            function hideMapFilter() {
                $('.js-store-map-sidebar-filter-button').parent().removeClass('is-active');
                $('.js-store-map-sidebar-filter').removeClass('is-active').fadeOut(150);
            }

            $('.js-store-map-sidebar-filter-button', context).once('store-map').on('click', (e) => {
                let id = $(e.currentTarget).data('target');
                let scrollBar;

                closeInfoBox();
                $(e.currentTarget).parent().toggleClass('is-active');
                $(id).toggleClass('is-active').fadeToggle(150);

                if (scrollBar === undefined) {
                    scrollBar = new SimpleBar($(id).get(0), {
                        autoHide: false
                    });
                } else {
                    scrollBar.recalculate();
                }
            });

            $(context).on('click', (e) => {
                let container = $(".store-map__sidebar__filter");
                // if the target of the click isn't the container nor a descendant of the container
                if (!container.is(e.target) && container.has(e.target).length === 0 && $('.js-store-map-sidebar-filter').hasClass('is-active')) {
                    hideMapFilter();
                }
            });

            // Toggle store week times
            $('.js-store-map-info-heading', context).once('store-map').on('click', (e) => {
                if ($(window).width() <= 992) {
                    let container = $(".store-map-info__icon__bar");
                    // if the target of the click isn't the container nor a descendant of the container
                    if (!container.is(e.target) && container.has(e.target).length === 0) {
                        handleWholeWeekTimesClick(e);
                    }
                } else {
                    handleWholeWeekTimesClick(e);
                }
            });

            // Locate user when crosshair in location field clicked
            $('.js-store-map-route-icon', context).once('store-map').on('click', handleGeolocationClick);
            $('.js-store-map-route-close', context).once('store-map').on('click', handleDirectionsClose);

            // Show directions to store when clicking on icon
            $('.js-store-map-info-directions', context).once('store-map').on('click', handleDirectionsOpen);

            // Close infoxBox on mobile if click on mask
            $('.store-map__footer__mask', context).once('store-map').on('click', () => {
                closeInfoBox();
                activeMarker = null;
            });

            // get user location
            $('#store-map-coords', context).once('store-map').on('click', handleGeolocationClick);

            // View selection controls
            $('#map-view-choice', context).find('a').once('store-map').on('click', handleViewChoiceClick);

            // hide filter
            $('.js-store-map-sidebar-city', context).find('.select-styled').once('store-map').on('click', () => {
                hideMapFilter();
                closeInfoBox();
            });

            $(context)
                .on('click', '.js-store-map-about-close', () => {
                    closeInfoBox();
                    activeMarker = null;
                })
                .on('click', '.js-store-map-about-directions', handleDirectionsOpen)
                .on('click', '.js-store-map-info-direction-link', (e) => {
                    navigate($(e.target))
                });

            // City change
            $('.js-store-map-sidebar-city', context).once('store-map').each((i, e) => {
                let $listItems = $(e).find('li');

                $listItems.on('click', (e) => {
                    let address = $(e.currentTarget).text();

                    if (address.trim() === 'Ogre') {
                        address = 'Ogre, Latvia';
                    }

                    closeTimeList();
                    geocoder.geocode({
                            'address': address
                        },
                        (results, status) => {
                            if (status === 'OK') {
                                map.setCenter(results[0].geometry.location);
                                map.setZoom(12);
                                showNearbyStores(results[0].geometry.location);
                            } else {
                                alert('Geocode was not successful for the following reason: ' + status);
                            }
                        });
                });
            });

            // hide footer on mobile
            function mapFullScreen() {
                if(!$('.store-map__container').hasClass('store-map__mobile-scroll')) {
                    $('.footer').addClass('d-none');
                    $('body').addClass('store-map--full');
                }
            }

            function mapWithScroll() {
                $('.footer').removeClass('d-none');
                $('body').removeClass('store-map--full');
            }

            if ($(window).width() <= 992) {
                if ($('.store-map__container').hasClass('list-view')) {
                    mapWithScroll();
                } else {
                    mapFullScreen();
                }
                // set full infoBox on mobile
                $('body', context).once('store-map').on('click', '.store-map__about', (e) => {
                    let container = $(".store-map__about");
                    let container2 = $(".js-store-map-get-info");

                    if (container.has(e.target).length > 0 && !$('.store-map__about').hasClass('is-full')) {
                        if (!container2.is(e.target) && !container2.has(e.target).length > 0) {
                            $('.store-map__about__slider').slideDown(300);
                            $('.store-map__about, .store-map__footer').addClass('is-full');
                            $('.store-map__footer__mask').addClass('is-active');
                            $('body').addClass('scroll-stop');
                        }
                    }
                });
            }

            $(window).once('store-map').on('resize', () => {
                if ($(window).width() <= 992) {
                    if ($('.store-map__container').hasClass('list-view')) {
                        mapWithScroll();
                    } else {
                        mapFullScreen();
                    }
                } else {
                  mapWithScroll();
                }
            });

            // Filter map
            $('.js-store-map-sidebar-filter', context).once('store-map').on('change', (e) => {
                let counter = $(e.currentTarget).find('input:checked').length;
                let checkedBoxes = ([...$('.js-store-map-sidebar-filter-input:checked')]).map((el) => {
                    return el.id;
                });
                let newMarkers = [];

                closeTimeList();
                // change counter
                if (counter <= 0) {
                    $('.js-store-map-sidebar-filter-counter').hide();
                } else {
                    $('.js-store-map-sidebar-filter-counter').show();
                }

                $('.js-store-map-sidebar-filter-counter').text(counter);

                // change store items
                for (let i = 0; i < markers.length; i++) {
                    marker = markers[i];
                    // Filter to show any markets containing ALL of the selected options
                    if (typeof marker.category === 'object' && checkedBoxes.every((el) => {
                        return (marker.category).indexOf(el) >= 0;
                    })) {
                        marker.setVisible(true);
                        newMarkers.push(marker);
                        $(`.store-map-info__container[id=${marker.storeID}]`).removeClass('d-none');
                    } else {
                        marker.setVisible(false);
                        $(`.store-map-info__container[id=${marker.storeID}]`).addClass('d-none');
                        closeTimeList(event);
                    }
                }

                if (newMarkers.length < 1) {
                    $('.js-store-map-not-found').fadeIn('200');
                } else {
                    $('.js-store-map-not-found').fadeOut('200');
                }

                // upd map markers
                markerClusterer.clearMarkers();
                markerClusterer.addMarkers(newMarkers);
                map.setZoom(12);
            });

            // set full infoBox on mobile
            $(context).find('.store-map__footer').swipe({
                swipeStatus: (event, phase, direction) => {
                    if (phase == "end") {
                        if ($(event.target) === $('.store-map__about') || $(event.target).closest('.store-map__about')) {
                            if (direction == 'up') {
                                $('.store-map__about__slider').slideDown(300);
                                $('.store-map__about, .store-map__footer').addClass('is-full');
                                $('.store-map__footer__mask').addClass('is-active');
                                $('body').addClass('scroll-stop');
                            }
                            if (direction == 'down') {
                                $('.store-map__about__slider').slideUp(300);
                                $('.store-map__about, .store-map__footer').removeClass('is-full');
                                $('.store-map__footer__mask').removeClass('is-active');
                                $('body').removeClass('scroll-stop');
                            }
                        }
                    }
                },
                threshold: 20
            });

        }
    };

})(jQuery, Drupal, drupalSettings);
