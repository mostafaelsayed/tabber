let tabsGroups = [];

function initializeTabsGrouping(options) {
    chrome.tabs.query({windowId: chrome.windows.WINDOW_ID_CURRENT}, (tabs) => {
        // group related tabs
        tabsGroups = getTabsGroups(tabs);

        // create context menu with items as the tabs groups
        initializeTabsGroupsContextMenu(tabsGroups);
    });
}

initializeTabsGrouping();

let createdTabId = '';
let createdTabUrl = '';

// when a tab is created
chrome.tabs.onCreated.addListener(function(createdTab) {
    console.log('created tab : ', createdTab);
    createdTabId = createdTab.id;
    createdTabUrl = createdTab.url;
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, updatedTab) => {
    handleTabUpdate(updatedTab, changeInfo);
});

function removeFromTabsGroupsIfItExistsOnce(tabsGroups, baseUrl) {
    let groupIndex = tabsGroups.findIndex((group) => {
        return group.baseUrl == baseUrl;
    });

    if (groupIndex !== -1) {
        if (tabsGroups[groupIndex].tabs < 2) {
            tabsGroups.splice(groupIndex, 1);
        }
    }

    return tabsGroups;
}

function handleTabUpdate(updatedTab, changeInfo) {
    // wait for url to update
    //console.log('updated tab : ', updatedTab);

    if (changeInfo.url) {
        tabsGroups = removeFromTabsGroupsIfItExistsOnce(tabsGroups, getBaseUrlOfAbsoluteUrl(createdTabUrl));
        console.log('url update : ', updatedTab);
        
        let baseUrl = getBaseUrlOfTab(updatedTab);

        chrome.tabs.query({}, (tabs) => {
            console.log('the tabs', tabs);
        });

        let baseUrlIndex = getBaseUrlIndexInsideTabsGroups(tabsGroups, baseUrl);

        console.log('baseUrlIndex : ', baseUrlIndex);

        console.log('base url after update :', baseUrl);
        // update tabs groups with this baseurl and tab

        tabsGroups = updateTabsGroupsWhenNewTabAndBaseUrlAdded(baseUrl, tabsGroups, updatedTab);
        
        console.log('tabsGroups after base url update :', tabsGroups);
        
        //console.log('tabsGroups after update : ', tabsGroups);

        // add an item to the context menu when it's only a new base url
        if (baseUrlIndex === -1) {
            chrome.windows.getCurrent({populate: true}, function(currentWindow) {
                chrome.contextMenus.create({
                    id: baseUrl,
                    title: baseUrl,
                });                    
            });   
        }

        createdTabUrl = updatedTab.url;
    }
}

function getBaseUrlPatterns(currentWindow) {
    let baseUrlPatterns = currentWindow.tabs.map((tab) => {
        let currentBaseUrlPattern = getBaseUrlOfTab(tab) + '/*';
        let baseUrlIndex = baseUrlPatterns.findIndex((baseUrl) => {
            return currentBaseUrlPattern.includes(baseUrl); 
        });

        if (baseUrlIndex === -1) {
            return currentBaseUrlPattern; 
        }
    });
}

// when a context menu item (tabsgroup) is clicked
// we should move this group to a new window (for now but better we need options to what we can do with this group)
chrome.contextMenus.onClicked.addListener(function(menuItemInfo, tab) {
    console.log('clicked menu item : ', menuItemInfo);
    console.log('tabsGroups after update : ', tabsGroups);
    let tabsGroupIndex = tabsGroups.findIndex((e) => {
        return e.baseUrl == menuItemInfo.menuItemId;
    });

    let tabsGroup = tabsGroups[tabsGroupIndex];

    chrome.contextMenus.removeAll(function() {
        // create new window
        chrome.windows.create((createdWindow) => {
            currentWindowId = createdWindow.id;
            firstTimeChange = false;
            let tabsIds = tabsGroup.tabs.map((tab) => {
                return tab.id;
            });

            console.log('tabsIds : ', tabsIds);

            // move this group to the new window
            chrome.tabs.move(tabsIds, {index: 0, windowId: createdWindow.id}, function() {
                // a new tab is created when we move to the new window and it become the active tab so we should delete it.
                chrome.tabs.query({active: true, windowId: createdWindow.id}, (tabs) => {
                    console.log('current tab inside contextMenu onclicked : ', tabs);
                    chrome.tabs.remove(tabs[0].id);
                    initializeTabsGrouping();
                });
            });    
        });
    });
});

let currentWindowId = -1;
let firstTimeChange = true;

chrome.tabs.onActivated.addListener(function(activeInfo) {
    console.log('tab changed');
    handleChangeInWindowOrTab(activeInfo.windowId, 'tab');
});

chrome.windows.onFocusChanged.addListener(function(windowId) {
    console.log('onFocusChanged : ');
    handleChangeInWindowOrTab(windowId, 'window');
});



function handleChangeInWindowOrTab(windowId, source) {    
        // console.log('currentWindowId : ', currentWindowId);
        // console.log('focused windowId : ', windowId);
        // console.log('firstTimeChange : ', firstTimeChange);
        if (currentWindowId == -1) {
            currentWindowId = windowId;
            firstTimeChange = false;
        }
        else if (windowId == currentWindowId && firstTimeChange == false && windowId != -1 && source == 'window') {
            return;
        }
        else if (windowId == currentWindowId && firstTimeChange == true && windowId != -1) {
            firstTimeChange = false;
        }
        else if (windowId != currentWindowId && windowId != -1) {
            currentWindowId = windowId;
            firstTimeChange = false;
        }
        
        if (windowId && windowId !== -1) {
            chrome.windows.get(windowId, {populate: true}, function(currentWindow) {
                tabsGroups = getTabsGroups(currentWindow.tabs);
                console.log('onFocusChanged tabsGroups : ', tabsGroups);
                initializeTabsGroupsContextMenu(tabsGroups);
            });
        }
}

function getBaseUrlOfTab(tab) {
    let url = tab.url;
    let baseUrl = url.substring(0, url.indexOf('/', url.indexOf('//') + 2));

    return baseUrl;
}

function getBaseUrlOfAbsoluteUrl(url) {
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
            continue;
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
    chrome.contextMenus.removeAll(function() {
        let counter = 0;

        console.log('tabsGroups in initializeTabsGroupsContextMenu : ', tabsGroups);

        for (let i = 0; i < tabsGroups.length; i++) {
            let myOptions = {
                id: tabsGroups[i].baseUrl,
                title: tabsGroups[i].baseUrl
            };

            chrome.contextMenus.create(myOptions, function() {
                counter++;

                console.log('counter : ', counter);

                if (counter == tabsGroups.length && callback) {
                    callback();
                }
            });
        }
    });
}