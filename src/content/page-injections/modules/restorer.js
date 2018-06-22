import { _MODULE } from './../../utils'
import _STORE from './../_store'
import _SELECTION from './selection'

class Restorer extends _MODULE {
  constructor(obj) {
    super(obj)
  }

  processPeuAPeu(data, func, cb) {
		let d = Array.prototype.slice.call(data),
			  done, time0;

		(function rec() {
			let max = +new Date() + 500;
			do {
				done = func(d[0]);
				if (done) d.shift();

			} while (d.length > 0 && max > +new Date());

			if (d.length > 0)
				window.setTimeout(() => rec(), 25);
			else cb();
		})();
	}
  setBodySelection(el) {
    let selection = this.selection = new _SELECTION(el);

    this.trimmedSelectionText = this.squeeze(selection.text);

    this.bodyTextNodes = selection.nodes;
    this.range = selection.range;

    return this;
  }
  squeeze(text) {
    return text.replace(/\t|\s|\n|\r/g, '');
  }
  whichChild(parent, child, context) {
		if (!parent || !child) return null;

		let children = child.nodeType === 3 ? parent.childNodes : parent.children,
		    c = children.length,
		    pos = 0, i = 0, currentChild;

    for ( ; i < c; i++) {
      currentChild = children[i];

			if (currentChild === child) return pos;

			if (context) {
				if (currentChild.nodeName === context) pos++;

			} else {
        if (!(currentChild.nodeType === 3 && !currentChild.data)) pos++;
      }
		}
	}
  report() {
    let ll = this.lost.length;
    if (ll) {
      while(ll--) {
        delete this.lost[ll].temp;
      }
      this.emit('failed:restoration');
    }else {
      this.emit('succeeded:restoration');
    }
    this.emit('finished:restoration', _STORE.name, this.restored, this.lost, this.area);
  }
}

export default function() {
  return [
    new Restorer({
      events: {
        ENV: {
          'restore:marks': 'init'
        }
      },
      queue: [],
      cache: [],
      lost: [],
      restored: [],
      area: 'sync',
      phase: 1,

      init(entry) {
        if (_STORE.pdf) return false;

        _STORE.name = entry.name;
        _STORE.entry = entry;

        let now = [], postponed = [],
            marks = entry.marks,
            l = marks.length,
            i = 0, mark;

        this.area = entry.synced ? 'sync' : 'local';

        for (; i < l; i++) {
          mark = marks[i];

          this.convertDescription(mark).createTempObject(mark);

          if (mark.conds.n1 === 'TM') postponed.push(mark);
          else now.push(mark);
        }

        this.queue.push(now);

        for (i = 0, l = postponed.length; i < l; i++)
          this.queue.push([postponed[i]]);

        this.restore().report();
      },
      convertDescription(mark) {
        if (typeof mark.conds.o === 'undefined') {
          let conds = mark.conds,
              convertedConds = {
                o: conds.startOffset,
                n1: conds.firstNodeName,
                n2: conds.firstParentNodeName,
                p1: conds.firstTextNodePosition,
                p2: conds.firstNodePosition,
                p3: conds.firstParentNodePosition,
                p4: conds.firstGrampaNodePosition
              };
          delete mark.conds;
          mark.conds = convertedConds;
        }
        return this;
      },
      createTempObject(mark) {
        let trimmedText = this.squeeze(mark.text);

        mark.temp = {
          trimmedText: trimmedText,
          trimmedTextLength: trimmedText.length,
          possiblePositions: [],
          possibleStartNodes: [],
          possibleEnds: {},
          possibleFocusOffsets: []
        };
      },
      restore() {
        if (this.phase === 2) this.sortQueueById();

        let marks = this.marks = this.queue.shift(),
            length = marks ? marks.length : 0;

        this.length = length;

        if (length) {
          this.setBodySelection(window.document.body)
              .getTextPositions(marks, length);

          if (this.phase === 1 && length > 1)
              this.postponeOverlappings();

          this.findPossibleExtrema()
              .ruleOutMultiples()
              .recreateMarks();
        }

        this.phase++;

        if (this.queue.length) this.restore();

        return this;
      },
      sortQueueById() {
        let marks = this.queue,
            l = marks ? marks.length : 0,
            temp = [],
            res = [],
            i = 0,
            mark, t;

        while (l--) {
          if (!marks[l].length) continue;
          mark = marks[l][0];
          temp[mark.id] = mark;
        }
        this.queue = [];

        for (t = temp.length; i < t; i++) {
          if (temp[i]) this.queue.push([temp[i]]);
        }
        return this;
      },
      getTextPositions(marks, l) {
        let trimmedSelectionText = this.trimmedSelectionText,
            allPossibleStartPositions = this.allPossibleStartPositions = [],
            endPositions = [],
            mark, markTemp, trimmedText, trimmedTextLength, p, endPosition;

        while (l--) {
          p = undefined;
          mark = marks[l];
          markTemp = mark.temp;

          if (!markTemp) {
            marks.splice(l, 1);
            continue;
          }

          trimmedText = markTemp.trimmedText;
          trimmedTextLength = markTemp.trimmedTextLength;

          while (p !== -1) {
            if (p === undefined) p = -1;
            p = trimmedSelectionText.indexOf(trimmedText, p + 1);
            endPosition = p + trimmedTextLength;
            markTemp.possiblePositions.push(p);
            allPossibleStartPositions.push([p, endPosition, mark]);
            endPositions.push(endPosition);
          }

          markTemp.possiblePositions.pop();
          allPossibleStartPositions.pop();
          endPositions.pop();

          if (!markTemp.possiblePositions.length)
            this.lost.push(mark);
        }
        this.sortPossibleStartPositions(allPossibleStartPositions);
        this.maxPosition = Math.max.apply(null, endPositions);

        return this;
      },
      sortPossibleStartPositions(positions) {
        let l = positions.length,
            temp = [],
            i = 0,
            pos, start, t;

        while (l--) {
          pos = positions[l];
          start = pos[0];

          if (temp[start]) temp.splice(start + 1, 0, pos);
          else temp[start] = pos;
        }
        t = temp.length;
        this.allPossibleStartPositions = [];

        for (; i < t; i++)
          if (temp[i]) this.allPossibleStartPositions.push(temp[i]);
      },
      postponeOverlappings() {
        let positions = this.allPossibleStartPositions,
            p = positions.length,
            postponed = [],
            pos1, pos2, i, m1, m2, id;

        if (p > 1) {
          while (p-- > 1) {
            pos1 = positions[p - 1];
            pos2 = positions[p];

            if (pos1[1] > pos2[0] && pos1[0] < pos2[1]) {
              m1 = pos1[2];
              m2 = pos2[2];

              if (m1.id < m2.id) {
                id = m2.id;

                if (!postponed.includes(id)) {
                  this.postpone(m2);
                  postponed.push(id);
                }
              }
              else {
                id = m1.id;

                if (!postponed.includes(id)) {
                  this.postpone(m1);
                  postponed.push(id);
                }
              }
            }
          }
          p = postponed.length;

          for (i = 0; i < p; i++)
            this.cutOutFor(postponed[i]);
        }
        return this;
      },
      cutOutFor(id) {
        let positions = this.allPossibleStartPositions,
            p = positions.length;

        while(p--) {
          if (positions[p][2].id === id)
            this.allPossibleStartPositions.splice(p, 1);
        }
      },
      postpone(mark) {
        let queue = this.queue,
            l = queue.length,
            alreadyIncluded = false;

        while (l--) {
          if (queue[l][0] === mark) {
            alreadyIncluded = true;
            break;
          }
        }
        if (!alreadyIncluded)
          this.queue.push([mark]);
      },
      findPossibleExtrema() {
        let selection = this.selection,
            range = this.range,
            nodes = this.bodyTextNodes,
            n = nodes.length,
            indices = this.allPossibleStartPositions,
            phase = this.phase,
            cache = this.cache = [],
            satisfied = [],
            i = 0, chars = 0,
            nextStartFound, endingsInThisNode,
            node, nodesText, nodesTextLength,
            mark, diff, l, startPosition, endPosition, e, f, id, p, q, x, m,
            possibleFocusOffset, startFoundFor, postponed, hasEndingsInThisNode;

        for (; i < n; i++) {
          node = nodes[i];
          nodesText = this.squeeze(node.data);
          nodesTextLength = nodesText.length;
          chars += nodesTextLength;
          l = indices.length;
          startFoundFor = [];
          postponed = [];
          hasEndingsInThisNode = null;

          while (l--) {
            startPosition = indices[l][0];
            endPosition = indices[l][1];
            mark = indices[l][2];
            id = mark.id;

            mark.temp.startFoundFor = mark.temp.startFoundFor || [];
            mark.temp.endFoundFor = mark.temp.endFoundFor || [];

            if (
              !mark.temp.startFoundFor.includes(startPosition) &&
              chars > startPosition &&
              mark.temp.possibleStartNodes.length < mark.temp.possiblePositions.length
            ) {
              if (hasEndingsInThisNode && hasEndingsInThisNode.id < mark.id) {
                if (phase === 1) {
                  this.postpone(mark);
                  postponed.push(id);
                }
                indices.splice(l, 1);

                continue;
              } else {
                if (!this.satisfiesDescription(mark, node)) {
                  if (phase === 1 && id !== 1) {
                    this.postpone(mark);
                    postponed.push(id);
                  }
                  indices.splice(l, 1);

                  continue;
                }
                else {
                  mark.temp.possibleStartNodes.push(node);
                  mark.temp.startFoundFor.push(startPosition);
                  startFoundFor.push(id);
                }
              }
            }
            if (
              mark.temp.startFoundFor.includes(startPosition) &&
              !mark.temp.endFoundFor.includes(endPosition) &&
              (chars - endPosition) >= 0
            ) {
              if (Math.min.apply(null, startFoundFor) < id) {
                if (phase === 1) {
                  this.postpone(mark);
                  postponed.push(id);
                }
                indices.splice(l, 1);
              } else {
                possibleFocusOffset = this.findFocusOffset(mark, node, endPosition - (chars - nodesTextLength));
                mark.temp.possibleFocusOffsets.push(possibleFocusOffset);
                mark.temp.endFoundFor.push(endPosition);
                mark.temp.possibleEnds[startPosition] = {
                  node: node,
                  offset: possibleFocusOffset
                };
                if (!satisfied.includes(id)) {
                  cache.push(mark);
                  satisfied.push(id);
                }

                hasEndingsInThisNode = mark;
                indices.splice(l, 1);
              }
            }
          }
          p = postponed.length;

          if (p) for (x = 0; x < p; x++) this.cutOutFor(postponed[x]);

          if (chars > this.maxPosition) break;
        }
        if (phase !== 1) {
          for (m in this.marks) {
            if (!satisfied.includes(this.marks[m].id)) this.lost.push(mark);
          }
        }
        return this;
      },
      ruleOutMultiples() {
        let cache = this.cache,
            i = cache.length,
            mark, possibleStartNodes, p, parent, grampa, grandgrampa, matches, failed, q;

        while (i--) {
          mark = cache[i];
          matches = [];
          failed = false;
          possibleStartNodes = mark.temp.possibleStartNodes;
          p = possibleStartNodes.length;

          if (p > 1) {
            while (p--) {
              parent = possibleStartNodes[p].parentNode.parentNode;
              grampa = parent.parentNode || 0;

              if (!grampa || mark.conds.p3 === this.whichChild(grampa, parent))
                matches.push(p);
            }
            if (!matches.length)
              p = 0;
            else {
              if (matches.length === 1) p = matches[0];
              else {
                p = undefined;

                while (matches.length) {
                  q = matches.pop();
                  parent = possibleStartNodes[q].parentNode;
                  grampa = parent.parentNode || 0;
                  grandgrampa = grampa && grampa.parentNode ? grampa.parentNode : 0;

                  if (!grandgrampa || mark.conds.p4 === this.whichChild(grandgrampa, grampa)) {
                    p = q;
                    break;
                  }
                }
                if (!p) p = 0;
              }
            }
          } else p = 0;

          p = p || 0;

          mark.temp.startNode = mark.temp.possibleStartNodes[p];

  				this.setMatchingEnd(mark, p);
        }
        return this;
      },
  		setMatchingEnd(mark, p) {
  			let startPosition = mark.temp.startFoundFor[p],
            end = mark.temp.possibleEnds[startPosition];

  			mark.temp.endNode = end.node;
  	    mark.temp.focusOffset = end.offset;
  		},
      satisfiesDescription(mark, node) {
        let description = mark.conds,
            parentNode = node.parentNode,
            grampa = parentNode.parentNode,
            grandgrampa = grampa && grampa.parentNode ? grampa.parentNode : 0,
            startOffset = description.o,
            relevantNodeText = node.data.substring(startOffset).trim(),
            l = relevantNodeText.length,
            markText = mark.text.trim(),
            m = markText.length,
            textsMatch;

        if (m <= l)
          textsMatch = this.squeeze(relevantNodeText).indexOf(this.squeeze(markText)) === 0;
        else
          textsMatch = this.squeeze(markText).indexOf(this.squeeze(relevantNodeText)) === 0;

        return (
          textsMatch &&
          (parentNode.nodeName === description.n1 || (description.n1 === 'TM' && parentNode.hasAttribute('data-tm-id'))) &&
          (!grampa || grampa.nodeName === description.n2) &&
          this.whichChild(parentNode, node) === description.p1
        );
      },
      findFocusOffset(mark, node, n) {
        let nodeText = node.data,
            l = nodeText.length,
            i = 0, counter = 0;

  			for (; i < l; i++) {
  				if (this.squeeze(nodeText[i])) counter++;

  				if (counter === n) return (/\s$/.test(mark.text) ? i + 2 : i + 1);
  			}
      },
      recreateMarks() {
        let range = this.range,
            selection = this.selection,
            marks = this.cache,
            i = marks.length,
            mark, markTemp, start, end, focusOffset;

        while (i--) {
          mark = marks[i];
          markTemp = mark.temp;
          start = markTemp.startNode;
          end = markTemp.endNode;
          focusOffset = markTemp.focusOffset;

          if (!start || !end || !(typeof focusOffset === 'number'))
            this.lost.push(mark);
          else {
            try {
              range.setStart(start, mark.conds.o);
              range.setEnd(end, focusOffset);
      			  selection.resume(range);
              this.emit('restored:range', selection, mark);
              this.restored.push(mark);
            } catch(e) {
              this.lost.push(mark);
            }
            delete mark.temp;
          }
        }
      }
    }),

    new Restorer({
      events: {
        ENV: {
          'restore:marks': 'init'
        }
      },
      sel: null,
      trimmedText: '',
      lost: [],
      restored: [],

      init(entry) {
        if (!_STORE.pdf) return false;

        _STORE.name = entry.name;
        _STORE.entry = entry;

        this.area = entry.synced ? 'sync' : 'local';

        this.restore(entry.marks, entry.count);
      },
      restore(marks, idCount) {
        //Mark.prototype.count = idCount;
        let m = marks.length,
            R = this,
            selection = this.selection,
            pageContainers = window.document.getElementsByClassName('page'),
            pages = {},
            markedPages = [],
            currPage, currContainer,
            mark, conds, startPage, endPage, p, i;

        for (i = 0; i < m; i++) {
          mark = marks[i];
          conds = mark.conds;
          startPage = conds.pages[0];
          markedPages.push(startPage);
          pages[startPage] = pages[startPage] || [];
          pages[startPage].push(mark);

          if (conds.pageIntersection) {
            endPage = conds.pages[1];

            do {
              pages[endPage] = pages[endPage] || [];
              pages[endPage].push(mark);
              markedPages.push(endPage);

            } while (--endPage > startPage);
          }
        }
        markedPages = unique(markedPages.sort((a, b) => a - b));

        function unique(arr) {
          let len = arr.length,
              res = [],
              i = 0;

          for ( ;i < len; i++)
            if (i === (len - 1) || arr[i] !== arr[i + 1]) res.push(arr[i]);

          return res;
        }

        function process(mark) {
          let text = mark.text,
              //currContainer = window.document.getElementById('pageContainer' + currPage),
              selection, range;

          R.setBodySelection(currContainer);
          selection = R.selection;
          range = R.range;

          if (!R.textExistsOnPage(currContainer, text)) {
            delete mark.conds;
            R.lost.push(mark);

            return true;
          }
          let conds = mark.conds,
              start = conds.containers[0],
              end = conds.containers[1],
              extremes = end === undefined ? [start, start] : [start, end],
              offsets = conds.offsets,
              divsOnPage, d, last;

          if (conds.pageIntersection) {
            if (conds.pages[0] === currPage) {
              extremes[1] = - 1;
              offsets[1] = -1;
            } else {
              extremes[0] = 0;
              offsets[0] = 0;
            }
          }
          extremes.forEach((pos, i) => {
            if (typeof pos === 'string') {
              extremes[i] = currContainer.querySelector('span[data-tm-id="' + pos + '"]');
            } else {
              divsOnPage = divsOnPage || currContainer.getElementsByClassName('textLayer')[0].querySelectorAll('div');
              d = d || divsOnPage.length;

              if (pos < 0) {
                last = extremes[1] = divsOnPage[d - 1];
                offsets[1] = last.lastChild.data.length;
              } else {
                extremes[i] = divsOnPage[pos];
              }
            }
          });

          extremes[1] = extremes[1] || extremes[0];

          try {
            range.setStart(extremes[0].childNodes[conds.nodes[0]], offsets[0]);
            range.setEnd(extremes[1].childNodes[conds.nodes[1]], offsets[1]);

            selection.resume(range);

            R.emit('restored:range', selection, mark);

            R.restored.push(mark);
          } catch(e) {
            delete mark.conds;
            R.lost.push(mark);
          }

          return true;
        }

        let monitorLoadingProcess = window.setInterval(() => {
              let l = markedPages.length,
                  idx, k, box, textBoxes, t;

              pageContainers = window.document.getElementsByClassName('page');

              if (!l) {
                window.clearInterval(monitorLoadingProcess);
                return false;
              }

              while (l--) {
                k = markedPages[l] - 1;

                if (
                  (box = pageContainers[k])
                 && box.hasAttribute('data-loaded')
                 && (textBoxes = box.querySelectorAll('.textLayer div'))
                 && (t = textBoxes.length)
                 && textBoxes[t - 2].firstChild
                 && textBoxes[t - 2].firstChild.data.length
                ) {
                  currPage = markedPages.splice(l, 1)[0];
  								currContainer = box;

                  R.processPeuAPeu(pages[currPage], process, R.proxy(R, R.report));
                }
              }
            }, 100);
      },
      textExistsOnPage(page, text) {
        let pageText = this.trimmedSelectionText;

        text = this.trimmedText = this.squeeze(text);

        return pageText.indexOf(text) !== -1;
      }
    })
  ];
}
