import { _PORT } from './utils'

new _PORT({
  name: 'background',
  type: 'background',
  postponeConnection: true,
  events: {
    ONEOFF: [
      'started:app',
      'toggled:addon',
      'toggled:sync',
      'toggled:sync-settings',
      'synced:entry',
      'updated:settings',
      'updated:history',
      'updated:history-on-restoration',
      'updated:logs',
      'updated:ctm-settings',
      'updated:misc-settings',
      'updated:bg-color-settings',
      'updated:custom-search-settings',
      'saved:entry',
      'deleted:entry',
      'deleted:entries',
      'imported:settings',
      'imported:history',
      'ctx:m',
      'ctx:d',
      'ctx:b',
      'ctx:-b',
      'ctx:n',
      'sidebar:highlight',
      'sidebar:delete-highlight',
      'sidebar:bookmark',
      'sidebar:delete-bookmark',
      'sidebar:note',
      'sidebar:save-changes',
      'sidebar:undo',
      'sidebar:redo',
      'sidebar:scroll-to-bookmark',
      'sidebar:toggle-notes'
    ],
    CONNECTION: [
      'started:app',
      'updated:settings',
      'updated:entry',
      'saved:entry',
      'toggled:sync-settings',
      'changed:selection',
      'unsaved-changes',
      'clicked:mark',
      'added:bookmark',
      'removed:bookmark',
      'added:note',
      'removed:last-note'
    ]
  }
});
