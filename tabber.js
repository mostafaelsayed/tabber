let tabsGroups = [];
let currentWindowId = -1;
let firstTimeChange = true;

function initializeTabsGrouping() {


    chrome.tabs.query({windowId: chrome.windows.WINDOW_ID_CURRENT}, (tabs) => {
        // group related tabs
        tabsGroups = getTabsGroups(tabs);

        // create context menu with items as the tabs groups
        initializeTabsGroupsContextMenu(tabsGroups);

        // when a tab is created
        chrome.tabs.onCreated.addListener(function(createdTab) {
            console.log('created tab : ', createdTab);
            
            // wait for url to update
            chrome.tabs.onUpdated.addListener((tabId, changeInfo, updatedTab) => {
                console.log('updated tab : ', updatedTab);
                if (createdTab.url != updatedTab.url && createdTab.id == updatedTab.id) {
                    let baseUrl = getBaseUrlOfTab(updatedTab);

                    // to prevent listening for update event again. we want only url changes
                    createdTab.url = updatedTab.url;

                    // we should not consider "chrome new tab" url
                    if (baseUrl == 'chrome://newtab') {
                        return;
                    }

                    chrome.tabs.query({}, (tabs) => {
                        console.log('the tabs', tabs);
                    });

                    let baseUrlIndex = getBaseUrlIndexInsideTabsGroups(tabsGroups, baseUrl);

                    console.log('baseUrlIndex : ', baseUrlIndex);

                    console.log('base url after update :', baseUrl);
                    // update tabs groups with this baseurl and tab
                    tabsGroups = updateTabsGroupsWhenNewTabAndBaseUrlAdded(baseUrl, tabsGroups, updatedTab);
                    
                    //console.log('tabsGroups after update : ', tabsGroups);
                    // add an item to the context menu when it's only a new base url
                    if (baseUrlIndex === -1) {
                        chrome.windows.getCurrent({populate: true}, function(currentWindow) {
                            let baseUrlPatterns = [];
                            baseUrlPatterns = currentWindow.tabs.map((tab) => {
                                let currentBaseUrlPattern = getBaseUrlOfTab(tab) + '/*';
                                let baseUrlIndex = baseUrlPatterns.findIndex((baseUrl) => {
                                    return currentBaseUrlPattern.includes(baseUrl); 
                                });

                                if (baseUrlIndex === -1) {
                                    //baseUrlPatterns.push(currentBaseUrlPattern)
                                    return currentBaseUrlPattern; 
                                }
                            });

                            chrome.contextMenus.create({
                                id: `${tabsGroups.length - 1}`,
                                title: baseUrl,
                                documentUrlPatterns: baseUrlPatterns
                            });
                        });
                        
                    }
                    
                }
            });
            // chrome.contextMenus.create({
            //     id: `${i}`,
            //     title: tabsGroups[i].baseUrl
            // });
        });

        // when a context menu item (tabsgroup) is clicked
        // we should move this group to a new window (for now but better we need options to what we can do with this group)
        chrome.contextMenus.onClicked.addListener(function(menuItemInfo, tab) {
            console.log('clicked menu item : ', menuItemInfo);
            console.log('tabsGroups after update : ', tabsGroups);
            let tabsGroupIndex = tabsGroups.findIndex((e, index) => {
                return index == parseInt(menuItemInfo.menuItemId);
            });

            let tabsGroup = tabsGroups[tabsGroupIndex];

            // create new window
            chrome.windows.create((createdWindow) => {
                currentWindowId = createdWindow.id;
                firstTimeChange = false;
                let tabsIds = tabsGroup.tabs.map((tab) => {
                    return tab.id;
                });

                console.log('tabsIds : ', tabsIds);

                // move this group to the new window
                chrome.tabs.move(tabsIds, {index: 0, windowId: createdWindow.id});

                // remove the group from the current context in the current page
                // chrome.contextMenus.remove(`${tabsGroupIndex}`);
                



                // chrome.windows.getCurrent({populate: true}, function(currentWindow) {
                //     chrome.contextMenus.update(`${tabsGroupIndex}`, {visible: !currentWindow.tabs.map((tab) => {return tab.url}).contains(tabsGroup.baseUrl)});
                //     let baseUrlPatterns = [];
                //     baseUrlPatterns = currentWindow.tabs.map((tab) => {
                //         let currentBaseUrlPattern = getBaseUrlOfTab(tab) + '/*';
                //         let baseUrlIndex = baseUrlPatterns.findIndex((baseUrl) => {
                //             return currentBaseUrlPattern.includes(baseUrl); 
                //         });

                //         if (baseUrlIndex === -1) {
                //             //baseUrlPatterns.push(currentBaseUrlPattern)
                //             return currentBaseUrlPattern; 
                //         }
                //     });

                //     console.log('baseUrlPatterns inside getcurrent: ', baseUrlPatterns);
                //     initializeTabsGroupsContextMenu([tabsGroup], {documentUrlPatterns: baseUrlPatterns});
                // });



                
                // a new tab is created when we move to the new window and it become the active tab so we should delete it.
                chrome.tabs.query({active: true, windowId: createdWindow.id}, (tabs) => {
                    console.log('current tab : ', tabs);
                    chrome.tabs.remove(tabs[0].id);
                });
            });
        });

        chrome.windows.onFocusChanged.addListener(function(windowId) {
            //chrome.windows.getCurrent(function(currentWindow) {
                //console.log('currentWindowId : ', currentWindowId);
                //console.log('focused windowId : ', windowId);
                //console.log('firstTimeChange : ', firstTimeChange);
                if (currentWindowId == -1) {
                    currentWindowId = windowId;
                    firstTimeChange = false;
                }
                else if (windowId == currentWindowId && firstTimeChange == false && windowId != -1) {
                    return;
                }
                else if (windowId == currentWindowId && firstTimeChange == true && windowId != -1) {
                    firstTimeChange = false;
                }
                else if (windowId != currentWindowId && windowId != -1) {
                    currentWindowId = windowId;
                    firstTimeChange = false;
                }
                console.log('onFocusChanged : ');
                if (windowId !== -1) {
                    chrome.contextMenus.removeAll(function() {
                        chrome.windows.get(windowId, {populate: true}, function(currentWindow) {
                            tabsGroups = getTabsGroups(currentWindow.tabs);
                            console.log('onFocusChanged tabsGroups : ', tabsGroups);
                            initializeTabsGroupsContextMenu(tabsGroups);
                        });
                    });
                    
                }
            //});
        });


    });

    //return tabsGroups;

    //console.log('tabsGroups : ', tabsGroups);
}

function getBaseUrlOfTab(tab) {
    let url = tab.url;
    let baseUrl = url.substring(0, url.indexOf('/', url.indexOf('//') + 2));

    return baseUrl;
}

function getBaseUrlIndexInsideTabsGroups(tabsGroups, baseUrl) {
    return tabsGroups.findIndex((group) => {
        return group.baseUrl == baseUrl;
    });
}

function getTabsGroups(tabs) {
    let tabsGroups = [];

    for (let i = 0; i < tabs.length; i++) {
        let currentBaseUrl = getBaseUrlOfTab(tabs[i]);
        if (currentBaseUrl == '') {
            break;
        }
        tabsGroups = updateTabsGroupsWhenNewTabAndBaseUrlAdded(currentBaseUrl, tabsGroups, tabs[i]);
    }

    return tabsGroups;
}

function updateTabsGroupsWhenNewTabAndBaseUrlAdded(baseUrl, tabsGroups, tab) {
    let tabIndexInGroup = tabsGroups.findIndex((group) => {
        return baseUrl == group.baseUrl;
    });

    if (tabIndexInGroup === -1) {
        tabsGroups.push({
            baseUrl: baseUrl,
            tabs: [tab]
        });
    }
    else {
        tabsGroups[tabIndexInGroup].tabs.push(tab);
    }

    return tabsGroups;
}

function initializeTabsGroupsContextMenu(tabsGroups, options, callback) {
    let counter = 0;

    console.log('options in initializeTabsGroupsContextMenu : ', options);
    console.log('tabsGroups in initializeTabsGroupsContextMenu : ', tabsGroups);

    for (let i = 0; i < tabsGroups.length; i++) {
        if (tabsGroups[i].baseUrl == 'chrome://newtab') {
            break;
        }
        let myOptions = {
            id: `${i}`,
            title: tabsGroups[i].baseUrl,
            documentUrlPatterns: options? options.documentUrlPatterns : undefined
            //options: options ? options : {}
        };

        if (options) {
            console.log('documentUrlPatterns : ', options.documentUrlPatterns);
        }
        chrome.contextMenus.create(myOptions, function() {
            counter++;

            console.log('counter : ', counter);

            if (counter == tabsGroups.length && callback) {
                callback();
            }
        });
    }

    
}

initializeTabsGrouping();
