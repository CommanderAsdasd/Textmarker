import { _MODULE } from './../../_shared/utils'
import _STORE from './../_store'

export default function() {
  return new _MODULE({
    events: {
      ENV: {
        'updated:logs': 'setLogLink'
      }
    },
    autoinit() {
      this.setAddonLinks()
          .setLogLink();
    },
    setAddonLinks() {
      let addonURL = browser.i18n.getMessage('url_moz_addon'),
          addonLinks = document.getElementsByClassName('moz-addon'),
          a = addonLinks.length,
          aL;

      while (a--) {
        aL = addonLinks[a];
        aL.href = addonURL;
        if (aL.id === 'moz-addon--contact') aL.innerText = addonURL;
      }

      return this;
    },
    setLogLink() {
      const logLink = document.getElementById('log-mail');

      _STORE.get('logs').then(logs => {
        let l = logs ? logs.length : 0,
            href =
              'mailto:undflybir@gmx.de?subject=Textmarker' +
              encodeURIComponent(' : Error Logs') +
              '&body='+
              encodeURIComponent('- ' + browser.i18n.getMessage('your_msg') + ' -\n\n\nLOGS:\n\n'),
            log;

        while(l--) {
          log = logs[l];
          href += (log[2] ? log[2] : log[1]) + ' - ' + encodeURIComponent((new Date(log[0]).toUTCString()) + '\n');
        }
        logLink.href = href;
      });
    }
  });
}
