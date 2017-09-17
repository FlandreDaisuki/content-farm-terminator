var filter;

function updateFilter() {
  return utils.getOptions({
    userBlacklist: "",
    userWhitelist: "",
    webBlacklist: ""
  }).then((lists) => {
    filter = new ContentFarmFilter();
    filter.addBlackList(lists.userBlacklist);
    filter.addWhiteList(lists.userWhitelist);
    let tasks = filter.parseRulesText(lists.webBlacklist).map((url) => {
      return filter.addBlackListFromUrl(url);
    });
    tasks.push(filter.addBuiltinBlackList());
    return Promise.all(tasks);
  }).then(() => {
    return new Promise((resolve, reject) => {
      chrome.tabs.query({}, resolve);
    }).then((tabs) => {
      tabs.forEach((tab) => {
        chrome.tabs.sendMessage(tab.id, {
          cmd: 'updateContent'
        });
      });
    });
  }).catch((ex) => {
    console.error(ex);
  });
}

chrome.webRequest.onBeforeRequest.addListener((details) => {
  var url = details.url;
  if (filter.isBlocked(url)) {
    let redirectUrl = `${chrome.runtime.getURL('blocked.html')}?to=${encodeURIComponent(url)}`;
    return {redirectUrl: redirectUrl};
  }
}, {urls: ["*://*/*"], types: ["main_frame", "sub_frame"]}, ["blocking"]);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // console.warn("omMessage", message);
  var {cmd, args} = message;
  switch (cmd) {
    case 'isUrlBlocked': {
      let blocked = filter.isBlocked(args.url);
      sendResponse(blocked);
      break;
    }
    case 'unblockTemp': {
      filter.unblockTemp(args.hostname);
      sendResponse(true);
      break;
    }
    case 'closeTab': {
      new Promise((resolve, reject) => {
        chrome.tabs.query({
          active: true,
          currentWindow: true
        }, resolve);
      }).then((tabs) => {
        return new Promise((resolve, reject) => {
          chrome.tabs.remove(tabs.map(x => x.id), resolve);
        });
      });
      sendResponse(true);
      break;
    }
  }
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'sync') {
    updateFilter();
  }
});

updateFilter();