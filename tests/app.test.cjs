const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');

function game() {
    const storage = new Map(), elements = new Map(), listeners = new Map(), intervals = new Map();
    let now = 0, intervalNumber = 0;
    const element = selector => {
        if (!elements.has(selector)) elements.set(selector, {
            open: false, textContent: '',
            showModal() { this.open = true; },
            close() { this.open = false; },
            addEventListener() {}
        });
        return elements.get(selector);
    };
    const context = vm.createContext({
        document: {querySelector: element, addEventListener: (name, handler) => listeners.set(name, handler)},
        window: {addEventListener: (name, handler) => listeners.set(name, handler)},
        localStorage: {getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value)},
        history: {pushState() {}, replaceState() {}},
        fetch: () => new Promise(() => {}),
        Date: {now: () => now},
        setInterval: handler => { intervals.set(++intervalNumber, handler); return intervalNumber; },
        clearInterval: id => intervals.delete(id)
    });
    vm.runInContext(read('app.js'), context);
    context.testData = JSON.parse(read('data.json'));
    context.testMessages = JSON.parse(read('locales/fr.json'));
    vm.runInContext('DATA = testData; messages = testMessages; render = () => saveProgress(); paintTimer = () => {};', context);
    const run = code => vm.runInContext(code, context);
    run('openCase(DATA.levels[0], DATA.levels[0].cases[0])');
    return {run, storage, element, listeners, intervals, advance: seconds => { now += seconds * 1000; }};
}

test('save and restore case, timer and suspect selection with the timer paused', () => {
    const {run, storage, advance} = game();
    run('start()');
    advance(12);
    run("enterView('check'); state.selected.add(1); saveProgress()");
    const saved = JSON.parse(storage.get('carnivore-progress'));
    assert.equal(saved.elapsed, 12);
    assert.equal(saved.view, 'check');
    assert.deepEqual(saved.selected, [1]);
    assert.equal(run('state = emptyState(); restoreProgress()'), true);
    assert.equal(run('state.elapsed'), 12);
    assert.equal(run('state.selected.has(1)'), true);
    assert.equal(run('state.running'), false);
    assert.equal(run('state.current.number'), saved.number);
});

test('pause and resume retain elapsed time and create only one interval', () => {
    const {run, advance, intervals} = game();
    run('start(); start()');
    assert.equal(intervals.size, 1);
    advance(5);
    run('stop()');
    assert.equal(intervals.size, 0);
    advance(20);
    assert.equal(run('state.elapsed'), 5);
    run('start()');
    advance(3);
    run('stop()');
    assert.equal(run('state.elapsed'), 8);
});

test('return from verification resumes only a previously running timer', () => {
    const {run} = game();
    run("enterView('check'); returnToCase()");
    assert.equal(run('state.running'), false);
    run("start(); enterView('check'); returnToCase()");
    assert.equal(run('state.running'), true);
});

test('Back closes help, returns from subviews and confirms leaving the case', () => {
    const {run, element, listeners} = game();
    run('openHelp()');
    listeners.get('popstate')();
    assert.equal(element('#help').open, false);
    for (const view of ['check', 'failure', 'result']) {
        run(`state.view = '${view}'`);
        listeners.get('popstate')();
        assert.equal(run('state.view'), 'case');
        assert.equal(element('#quit').open, false);
    }
    listeners.get('popstate')();
    assert.equal(element('#quit').open, true);
    element('#stay').onclick();
    assert.equal(run('state.view'), 'case');
});

test('leaving keeps a resumable save and hiding the app pauses the clock', () => {
    const {run, element, listeners, storage, advance} = game();
    run('start()');
    advance(9);
    listeners.get('pagehide')();
    assert.equal(run('state.running'), false);
    assert.equal(run('state.elapsed'), 9);
    element('#leave').onclick();
    assert.equal(run('state.view'), 'home');
    assert.equal(JSON.parse(storage.get('carnivore-progress')).elapsed, 9);
    assert.equal(run('restoreProgress()'), true);
});

test('verification produces both success and failure states', () => {
    const {run} = game();
    run('state.selected = new Set(state.current.solution); verify()');
    assert.equal(run('state.view'), 'result');
    assert.equal(run('state.revealed'), false);
    run('state.selected = new Set(); verify()');
    assert.equal(run('state.view'), 'failure');
});

test('invalid saved data does not restore an unrelated case', () => {
    const {run, storage} = game();
    storage.set('carnivore-progress', '{bad json');
    assert.equal(run('restoreProgress()'), false);
    storage.set('carnivore-progress', JSON.stringify({version: 1, dossier: 999, number: 1}));
    assert.equal(run('restoreProgress()'), false);
});

test('translations have matching keys and interpolation placeholders', () => {
    const french = JSON.parse(read('locales/fr.json')), english = JSON.parse(read('locales/en.json'));
    assert.deepEqual(Object.keys(french).sort(), Object.keys(english).sort());
    for (const key of Object.keys(french)) {
        assert.deepEqual(french[key].match(/\{\w+\}/g), english[key].match(/\{\w+\}/g), key);
        assert.ok(french[key].length, key);
        if (key !== 'brandSuffix') assert.ok(english[key].length, key);
    }
    const {run} = game();
    assert.equal(run("countText('suspects', 1)"), '1 suspect');
    assert.equal(run("countText('truths', '3-4')"), '3-4 vérités');
});

test('brand titles retain French wording and omit the extra suffix in English', () => {
    const french = JSON.parse(read('locales/fr.json')), english = JSON.parse(read('locales/en.json'));
    const title = messages => [messages.brandPrefix, messages.brandSuffix].filter(Boolean).join(' ');
    assert.equal(title(french), 'LE COUPABLE EST… CARNIVORE');
    assert.equal(title(english), 'A carnivore did it!');
    assert.equal(english.appTitle, 'A carnivore did it!');
    assert.match(read('index.html'), /data-i18n="brandSuffix"/);
});