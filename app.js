const $ = selector => document.querySelector(selector);
const SAVE_KEY = 'carnivore-progress';
const LANGUAGES = {fr: 'Français', en: 'English'};
let DATA, messages, language = 'fr', clockAnchor = 0, clockElapsed = 0;
let state = emptyState();

function emptyState() {
	return {view: 'home', level: null, current: null, elapsed: 0, running: false,
		started: false, selected: new Set(), timerId: null, resumeRunning: false, revealed: false};
}
function readStorage(key, fallback = null) {
	try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function writeStorage(key, value) {
	try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}
const used = () => readStorage('carnivore-used', {});
const saveUsed = value => writeStorage('carnivore-used', value);
function esc(value) {
	return String(value).replace(/[&<>"']/g, character => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[character]));
}
function t(key, values = {}) {
	return String(messages[key] ?? key).replace(/\{(\w+)\}/g, (match, name) => esc(values[name] ?? match));
}
function countText(key, count) { return t(`${key}.${Number(count) === 1 ? 'one' : 'other'}`, {count}); }
function level(number) { return DATA.levels.find(item => item.dossier === number); }
function fmt(seconds) {
	return String(Math.floor(seconds / 60)).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0');
}
function syncClock() {
	if (state.running) state.elapsed = clockElapsed + Math.floor((Date.now() - clockAnchor) / 1000);
}
function saveProgress() {
	if (!state.current) return;
	syncClock();
	writeStorage(SAVE_KEY, {version: 1, dossier: state.level.dossier, number: state.current.number,
		view: state.view, elapsed: state.elapsed, started: state.started, selected: [...state.selected],
		resumeRunning: state.resumeRunning, revealed: state.revealed, helpOpen: $('#help').open});
}
function restoreProgress() {
	const saved = readStorage(SAVE_KEY);
	const dossier = saved && level(saved.dossier);
	const current = dossier?.cases.find(item => item.number === saved.number);
	if (saved?.version !== 1 || !current) return false;
	state = {...emptyState(), level: dossier, current,
		view: ['case', 'check', 'failure', 'result'].includes(saved.view) ? saved.view : 'case',
		elapsed: Number.isFinite(saved.elapsed) ? Math.max(0, Math.floor(saved.elapsed)) : 0,
		started: !!saved.started, revealed: !!saved.revealed,
		selected: new Set((Array.isArray(saved.selected) ? saved.selected : [])
			.filter(number => Number.isInteger(number) && number >= 1 && number <= dossier.suspects)
			.slice(0, dossier.culpritCount))};
	return true;
}
function stop() {
	syncClock();
	state.running = false;
	if (state.timerId !== null) clearInterval(state.timerId);
	state.timerId = null;
	saveProgress();
}
function start() {
	if (state.running) return;
	state.running = true;
	state.started = true;
	clockAnchor = Date.now();
	clockElapsed = state.elapsed;
	state.timerId = setInterval(() => { syncClock(); paintTimer(); saveProgress(); }, 1000);
	paintTimer();
	saveProgress();
}
function paintTimer() {
	const timer = $('#timer');
	if (!timer) return;
	timer.textContent = fmt(state.elapsed);
	const thresholds = state.level.times.map(value => value * 60);
	let band = '';
	thresholds.forEach((threshold, index) => { if (state.elapsed >= threshold) band = 't' + (index + 1); });
	timer.className = 'timer ' + band;
	let action = 'timer.start';
	if (state.started) action = 'timer.resume';
	if (state.running) action = 'timer.pause';
	$('#start').textContent = t(action);
}
function pushView(view) { history.pushState({carnivore: true, view}, ''); }
function home(keepProgress = false) {
	stop();
	if (!keepProgress) writeStorage(SAVE_KEY, null);
	state = emptyState();
	history.replaceState({carnivore: true, view: 'home'}, '');
	render();
}
function openCase(dossier, current) {
	if (!dossier || !current) return;
	stop();
	const playedByLevel = used(), played = playedByLevel[dossier.dossier] || [];
	if (!played.includes(current.number)) {
		playedByLevel[dossier.dossier] = [...played, current.number];
		saveUsed(playedByLevel);
	}
	state = {...emptyState(), level: dossier, current, view: 'case'};
	pushView('case');
	render();
}
function choose(number) {
	const dossier = level(number), playedByLevel = used(), played = playedByLevel[number] || [];
	const available = dossier.cases.map(item => item.number);
	let pool = available.filter(item => !played.includes(item));
	if (!pool.length) { pool = available; playedByLevel[number] = []; saveUsed(playedByLevel); }
	const picked = pool[Math.floor(Math.random() * pool.length)];
	openCase(dossier, dossier.cases.find(item => item.number === picked));
}
function updateManualCases() {
	const dossier = level(Number($('#manualLevel').value)), select = $('#manualCase');
	select.innerHTML = `<option value="">${t('chooseCase')}</option>` + (dossier?.cases || [])
		.map(item => `<option value="${item.number}">${t('caseNumber', {number: item.number})}</option>`).join('');
	select.disabled = !dossier?.cases.length;
	$('#manualOpen').disabled = true;
}
function fact(icon, text, kind = 'img') {
	const visual = kind === 'x' ? '<span class="xicon">×</span>' : `<img src="assets/${icon}" alt="">`;
	return `<div class="fact">${visual}<b>${text}</b></div>`;
}
function enterView(view, revealed = false) {
	state.resumeRunning = state.running;
	stop();
	state.view = view;
	state.revealed = revealed;
	if (view === 'check') state.selected = new Set();
	pushView(view);
	render();
}
function returnToCase() {
	const resume = state.resumeRunning;
	state.view = 'case';
	state.resumeRunning = false;
	render();
	if (resume) start();
}
function resultActions() {
	return `<div class="actions"><button id="back" class="primary">${t('backToCase')}</button><button id="menu" class="secondary">${t('backHome')}</button></div>`;
}
function selectSuspect(number) {
	if (state.selected.has(number)) state.selected.delete(number);
	else if (state.selected.size < state.level.culpritCount) state.selected.add(number);
	render();
}
function renderHome(screen) {
		screen.innerHTML = `<img class="hero" src="assets/illustration_couverture.jpg" alt="${t('coverAlt')}">
			<div class="notice"><b>${t('physicalRequired')}</b><br>${t('physicalNotice')}</div>
			${readStorage(SAVE_KEY) ? `<button id="resume" class="primary">${t('resumeCase')}</button>` : ''}
			<h1>${t('randomDraw')}</h1><div class="grid">${DATA.levels.map(dossier => `<button class="case-btn" data-level="${dossier.dossier}" ${dossier.cases.length ? '' : 'disabled'}>${String(dossier.dossier).padStart(2, '0')}<small>${countText('availableCases', dossier.cases.length)}</small></button>`).join('')}</div>
			<p class="muted">${t('drawNotice')}</p><section class="manual-picker"><h2>${t('manualTitle')}</h2><p>${t('manualNotice')}</p>
			<div class="manual-fields"><label>${t('dossier')}<select id="manualLevel"><option value="">${t('chooseDossier')}</option>${DATA.levels.filter(dossier => dossier.cases.length).map(dossier => `<option value="${dossier.dossier}">${t('dossierNumber', {number: String(dossier.dossier).padStart(2, '0')})}</option>`).join('')}</select></label>
			<label>${t('caseLabel')}<select id="manualCase" disabled><option value="">${t('chooseCase')}</option></select></label></div><button id="manualOpen" class="primary" disabled>${t('openCase')}</button></section>`;
		screen.querySelectorAll('[data-level]').forEach(button => button.onclick = () => choose(Number(button.dataset.level)));
		$('#manualLevel').onchange = updateManualCases;
		$('#manualCase').onchange = () => { $('#manualOpen').disabled = !$('#manualCase').value; };
		$('#manualOpen').onclick = () => {
			const dossier = level(Number($('#manualLevel').value));
			openCase(dossier, dossier?.cases.find(item => item.number === Number($('#manualCase').value)));
		};
		if ($('#resume')) $('#resume').onclick = () => {
			if (!restoreProgress()) return;
			pushView('case');
			if (state.view !== 'case') pushView(state.view);
			render();
		};
}
function renderCheck(screen, dossier) {
	screen.innerHTML = `<h1>${t('yourSolution')}</h1><p>${countText('selectExactly', dossier.culpritCount)}</p>
		<div class="suspects ${dossier.suspects > 4 ? 'suspects-compact' : ''}" style="--suspect-rows:${Math.ceil(dossier.suspects / 3)}">${Array.from({length: dossier.suspects}, (_, index) => `<button class="suspect ${state.selected.has(index + 1) ? 'selected' : ''}" data-suspect="${index + 1}" aria-pressed="${state.selected.has(index + 1)}"><img src="assets/suspect_${index + 1}.webp" alt="${t('suspectNumber', {number: index + 1})}"></button>`).join('')}</div>
		<div class="actions"><button id="verify" class="primary" ${state.selected.size === dossier.culpritCount ? '' : 'disabled'}>${t('verify')}</button><button id="back" class="secondary">${t('backToCase')}</button></div>`;
	screen.querySelectorAll('[data-suspect]').forEach(button => button.onclick = () => selectSuspect(Number(button.dataset.suspect)));
	$('#verify').onclick = verify;
}
function render() {
	const screen = $('#screen');
	screen.className = state.view === 'check' ? 'check-screen' : '';
	if (state.view === 'home') {
		renderHome(screen);
		return;
	}
	const dossier = state.level, current = state.current;
	if (state.view === 'case') {
		const lies = dossier.statementType === 'mensonges';
		screen.innerHTML = `<h1 class="case-title">${t('caseTitle', {dossier: String(dossier.dossier).padStart(2, '0'), number: current.number})}</h1>
			<div id="timer" class="timer">${fmt(state.elapsed)}</div><div class="facts">
			${fact('illustration_suspects.png', countText('suspects', dossier.suspects))}
			${fact('illustration_coupables.png', countText('culpritsToFind', dossier.culpritCount))}
			${fact('illustration_verites.png', countText(lies ? 'lies' : 'truths', dossier.statementCount), lies ? 'x' : 'img')}
			${fact('illustration_chronometre.png', t('thresholds', {times: dossier.times.join(' / ')}))}</div>
			<h2>${t('testimonyCards')}</h2><div class="fact cards">${current.testimonies.join(' · ')}</div><p class="warning">${t('scanWarning')}</p>
			<div class="actions"><button id="start" class="primary"></button><button id="check" class="secondary">${t('checkSolution')}</button><button id="show" class="danger">${t('showSolution')}</button></div>`;
		$('#start').onclick = () => { if (state.running) { stop(); paintTimer(); } else start(); };
		$('#check').onclick = () => enterView('check');
		$('#show').onclick = () => { if (confirm(t('revealConfirm'))) enterView('result', true); };
		paintTimer();
	} else if (state.view === 'check') {
		renderCheck(screen, dossier);
	} else if (state.view === 'failure') {
		screen.innerHTML = `<div class="result"><div class="badge failure">${t('wrongSolution')}</div>${resultActions()}</div>`;
	} else if (state.view === 'result') {
		screen.innerHTML = `<div class="result"><div class="badge success">${t(state.revealed ? 'solution' : 'caseSolved')}</div>
			<div class="culprits">${current.solution.map(number => `<img src="assets/suspect_${number}.webp" alt="${t('culpritNumber', {number})}">`).join('')}</div>
			<p>${t('time')} <b>${fmt(state.elapsed)}</b></p>${resultActions()}</div>`;
	}
	if ($('#back')) $('#back').onclick = () => history.back();
	if ($('#menu')) $('#menu').onclick = requestHome;
	saveProgress();
}
function verify() {
	const selected = [...state.selected].sort((first, second) => first - second);
	const solution = [...state.current.solution].sort((first, second) => first - second);
	const correct = selected.length === solution.length && selected.every((number, index) => number === solution[index]);
	state.view = correct ? 'result' : 'failure';
	state.revealed = false;
	history.replaceState({carnivore: true, view: state.view}, '');
	render();
}
function requestHome() {
	if (state.current) $('#quit').showModal();
	else home();
}
function openHelp() {
	pushView('help');
	$('#help').showModal();
	saveProgress();
}
window.addEventListener('popstate', () => {
	if ($('#help').open) { $('#help').close(); saveProgress(); return; }
	if ($('#quit').open) { $('#quit').close(); pushView('case'); return; }
	if (state.current && state.view !== 'case') { returnToCase(); return; }
	if (state.current) { pushView('case'); requestHome(); }
});
$('#homeBtn').onclick = requestHome;
$('#helpBtn').onclick = openHelp;
$('#closeHelp').onclick = () => history.back();
$('#help').addEventListener('cancel', event => { event.preventDefault(); history.back(); });
$('#stay').onclick = () => $('#quit').close();
$('#leave').onclick = () => {
	$('#quit').close();
	home(true);
};
window.addEventListener('pagehide', () => stop());
document.addEventListener('visibilitychange', () => {
	if (document.visibilityState === 'hidden') stop();
	else paintTimer();
});

async function setLanguage(nextLanguage) {
	if (!Object.hasOwn(LANGUAGES, nextLanguage)) nextLanguage = 'fr';
	const response = await fetch(`locales/${nextLanguage}.json`);
	if (!response.ok) throw new Error('Translation unavailable');
	messages = await response.json();
	language = nextLanguage;
	writeStorage('carnivore-language', language);
	document.documentElement.lang = language;
	document.title = t('appTitle');
	document.querySelectorAll('[data-i18n]').forEach(element => { element.textContent = t(element.dataset.i18n); });
	document.querySelectorAll('[data-i18n-label]').forEach(element => { element.setAttribute('aria-label', t(element.dataset.i18nLabel)); });
	$('#helpContent').innerHTML = messages.helpHtml;
	$('#languageFlag').src = `assets/flag-${language}.svg`;
	const label = `${t('language')} : ${LANGUAGES[language]}`;
	$('#language').setAttribute('aria-label', label);
	$('#language').title = label;
	document.querySelectorAll('[data-language]').forEach(button => {
		button.setAttribute('aria-pressed', String(button.dataset.language === language));
	});
	render();
}
$('#languageMenu').onclick = async event => {
	const button = event.target.closest('[data-language]');
	if (!button || button.disabled) return;
	const options = document.querySelectorAll('[data-language]');
	options.forEach(option => { option.disabled = true; });
	try {
		await setLanguage(button.dataset.language);
		$('#languageMenu').open = false;
		$('#language').focus();
	} catch {
		$('#languageMenu').open = true;
	} finally {
		options.forEach(option => { option.disabled = false; });
	}
};
document.addEventListener('click', event => {
	if (!$('#languageMenu').contains(event.target)) $('#languageMenu').open = false;
});
document.addEventListener('keydown', event => {
	if (event.key === 'Escape' && $('#languageMenu').open) {
		event.preventDefault();
		$('#languageMenu').open = false;
		$('#language').focus();
	}
});
async function init() {
	try {
		DATA = await fetch('data.json').then(response => response.json());
		history.replaceState({carnivore: true, view: 'home'}, '');
		const helpOpen = readStorage(SAVE_KEY)?.helpOpen;
		if (restoreProgress()) {
			pushView('case');
			if (state.view !== 'case') pushView(state.view);
		}
		const preferred = readStorage('carnivore-language', 'fr');
		try { await setLanguage(preferred); } catch { await setLanguage('fr'); }
		if (helpOpen && state.current) openHelp();
		if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').then(() => silentUpdate()).catch(() => {});
	} catch {
		$('#screen').textContent = messages?.loadError || 'Impossible de charger les données locales.';
	}
}
async function silentUpdate() {
	try {
		const response = await fetch('version.json?ts=' + Date.now(), {cache: 'no-store'});
		if (!response.ok) return;
		const version = (await response.json()).version, old = localStorage.getItem('carnivore-version');
		if (old && old !== version) {
			const registration = await navigator.serviceWorker.getRegistration();
			await registration?.update();
			localStorage.setItem('carnivore-version', version);
			stop();
			location.reload();
		} else localStorage.setItem('carnivore-version', version);
	} catch {}
}
document.addEventListener('DOMContentLoaded', init, {once: true});