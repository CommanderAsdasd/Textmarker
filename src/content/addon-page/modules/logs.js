import { _DOMMODULE } from './../../utils'
import _STORE from './../_store'
import _LOG_KEYS from '../../../data/log-keys'

export default function() {
  return new _DOMMODULE({
    el: document.getElementById('logs'),
    events: {
      ENV: {
        'updated:logs': 'log'
      },
      DOM: {
        click: {
          '#clear-logs': 'clear'
        }
      }
    },
    autoinit() {
      this.log();
    },
    log() {
      _STORE.get('logs').then(logs => {
        logs = logs || [];
        let logsTable = document.getElementById('logs-table'),
            tableBody = logsTable.getElementsByTagName('tbody')[0],
            noLogs = document.getElementById('no-logs'),
            clearBtn = document.getElementById('clear-logs'),
            l = logs.length,
            frag = document.createDocumentFragment(),
            tr, td_date, td_msg, node_date, node_msg, log, time, msg;

        if (l) {
          noLogs.classList.add('none');
          logsTable.classList.remove('none');
          clearBtn.classList.remove('none');
          while(l--) {
            log = logs[l];
            msg = log[1];
            if (typeof msg === 'number') msg = browser.i18n.getMessage(_LOG_KEYS.getKeyByValue(log[1]));
            //'nu',{year:'numeric',month:'2-digit',day:'2-digit',hour:'numeric',second:'numeric',minute:'numeric'}
            time = this.optimizeDateString((new Date(log[0])).toLocaleString());
            tr = document.createElement('tr');
            td_date = document.createElement('td');
            td_msg = document.createElement('td');
            node_date = document.createTextNode(time);
            node_msg = document.createTextNode(msg);

            td_date.appendChild(node_date);
            td_msg.appendChild(node_msg);
            tr.appendChild(td_date);
            tr.appendChild(td_msg);
            frag.appendChild(tr);
          }
          tableBody.innerText = '';
          tableBody.appendChild(frag);
        } else {
          noLogs.classList.remove('none');
          logsTable.classList.add('none');
          clearBtn.classList.add('none');
        }
      });
    },
    clear() {
      this.emit('clear:logs');
    },
    optimizeDateString(date) {
      return (date
        .replace(/^(\d{1})(\D{1})/, (m, p, q)=> '0' + p + q)
        .replace(/(\D{1})(\d{1}\D{1})/g, (m, p, q) => p + '0' + q));
    }
  });
}
