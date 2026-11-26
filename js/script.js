/* ChatMock ("Papo") — conversas salvas no navegador, respostas automáticas, reações e busca */

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const banco = {
  ler(k, padrao) { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? padrao; } catch { return padrao; } },
  salvar(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sem storage */ } }
};
const escapar = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const MIN = 6e4, H = 36e5, D = 864e5;
const iniciais = (n) => n.split(' ').filter((p) => /^[A-ZÀ-Ú]/.test(p)).slice(0, 2).map((p) => p[0]).join('') || n[0];
const EMOJIS = '😀 😂 🥹 😍 😎 🤔 😅 😴 👍 👏 🙏 💪 🔥 🎉 ❤️ 💜 ✅ ❌ 👀 🤝 ☕ 🍕 ⚽ 🚀 📅 📌 💡 🎧 🌧️ ☀️ 😢 😡'.split(' ');
const REACOES = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

/* ---------- Dados de exemplo ---------- */
function exemplo() {
  const agora = Date.now(), m = (de, txt, atras, extra = {}) => ({ id: uid(), de, txt, em: agora - atras, ...extra });
  return [
    { id: 'c1', nome: 'Marina Costa', cor: '#e5484d', online: true, naoLidas: 2, msgs: [
      m('ela', 'Oi! Conseguiu ver o layout novo?', D + 3 * H), m('eu', 'Vi sim! Ficou muito bom 👏', D + 2.9 * H, { status: 3 }),
      m('ela', 'Que bom! Só falta ajustar a versão do celular', D + 2.8 * H), m('ela', 'Amanhã a gente revisa juntos?', 25 * MIN), m('ela', 'Pode ser às 10h ☕', 24 * MIN)] },
    { id: 'c2', nome: 'Time do Projeto', cor: '#5b5bd6', grupo: true, membros: ['Lucas', 'Bia', 'Rafa'], naoLidas: 5, msgs: [
      m('Lucas', 'Pessoal, subi a versão nova no servidor de testes', 3 * H), m('Bia', 'Testei aqui, o formulário tá funcionando 🎉', 2.5 * H),
      m('eu', 'Show! Vou conferir o menu no celular', 2.4 * H, { status: 3 }), m('Rafa', 'O botão de enviar tá meio escondido no iPhone', 1.2 * H),
      m('Lucas', 'Vou ver isso agora', 1.1 * H), m('Bia', 'Reunião de alinhamento sexta?', 40 * MIN), m('Rafa', '👍', 38 * MIN), m('Lucas', 'Fechado', 35 * MIN), m('Bia', 'Vou mandar o convite', 30 * MIN)] },
    { id: 'c3', nome: 'Suporte Papo', cor: '#30a46c', bot: true, online: true, naoLidas: 0, msgs: [
      m('ela', 'Olá! 👋 Eu sou o assistente do Papo. Tente me mandar "ajuda", "piada", "hora" ou "dica".', 2 * D)] },
    { id: 'c4', nome: 'Lucas Andrade', cor: '#f08c2a', naoLidas: 0, msgs: [
      m('ela', 'Valeu pela ajuda ontem!', 2 * D), m('eu', 'Imagina, tamo junto 🤝', 2 * D - 10 * MIN, { status: 3, reacao: '❤️' })] },
    { id: 'c5', nome: 'Futebol de quinta ⚽', cor: '#0090ff', grupo: true, membros: ['Diego', 'Caio', 'Pedro'], naoLidas: 0, msgs: [
      m('Diego', 'Quinta tem jogo? Quem confirma?', 4 * D), m('Caio', 'Eu vou!', 4 * D - H), m('eu', 'Tô dentro', 4 * D - 2 * H, { status: 3 })] },
    { id: 'c6', nome: 'Beatriz Lima', cor: '#d6409f', naoLidas: 0, msgs: [m('ela', 'Me manda aquele link depois?', 9 * D)] }
  ];
}
let conversas = banco.ler('pm_conv', null) || exemplo();
let atual = null, aba = 'todas', respondendo = null, digitando = {}, buscaGlobal = '';
const salvar = () => banco.salvar('pm_conv', conversas);
const conv = (id) => conversas.find((c) => c.id === id);
let tema = banco.ler('pm_tema', matchMedia('(prefers-color-scheme: dark)').matches ? 'escuro' : 'claro');

/* ---------- Formatação ---------- */
const hora = (t) => new Date(t).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
function diaTexto(t) {
  const d = new Date(t), hoje = new Date(); const ini = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const dif = Math.round((ini(hoje) - ini(d)) / D);
  return dif === 0 ? 'Hoje' : dif === 1 ? 'Ontem' : dif < 7 ? d.toLocaleDateString('pt-BR', { weekday: 'long' }) : d.toLocaleDateString('pt-BR');
}
const quandoLista = (t) => { const d = diaTexto(t); return d === 'Hoje' ? hora(t) : d; };
const soEmoji = (t) => /^(\p{Extended_Pictographic}|️|‍|\s){1,6}$/u.test(t.trim());
const marcar = (txt, q) => (q ? escapar(txt).replace(new RegExp(escapar(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), (x) => `<mark>${x}</mark>`) : escapar(txt));
const autorNome = (c, m) => (m.de === 'eu' ? 'Você' : c.grupo ? m.de : c.nome.split(' ')[0]);

/* ---------- Lista ---------- */
function renderLista() {
  const q = buscaGlobal.toLowerCase();
  let lista = [...conversas].sort((a, b) => (b.msgs.at(-1)?.em || 0) - (a.msgs.at(-1)?.em || 0));
  if (aba === 'nao-lidas') lista = lista.filter((c) => c.naoLidas);
  if (aba === 'grupos') lista = lista.filter((c) => c.grupo);
  if (q) lista = lista.filter((c) => c.nome.toLowerCase().includes(q) || c.msgs.some((m) => m.txt.toLowerCase().includes(q)));
  $('#lista').innerHTML = lista.map((c) => {
    const u = c.msgs.at(-1), dig = digitando[c.id];
    const achou = q && !c.nome.toLowerCase().includes(q) ? c.msgs.findLast((m) => m.txt.toLowerCase().includes(q)) : null;
    const prev = dig ? `${c.grupo ? dig + ' está ' : ''}digitando…` : achou ? `🔍 ${achou.txt}` : u ? `${u.de === 'eu' ? 'Você: ' : c.grupo ? u.de + ': ' : ''}${u.txt}` : 'Sem mensagens';
    return `<li class="item${c.id === atual ? ' ativo' : ''}${c.naoLidas ? ' nao-lida' : ''}" data-id="${c.id}" tabindex="0" role="button" aria-label="Conversa com ${escapar(c.nome)}${c.naoLidas ? `, ${c.naoLidas} não lidas` : ''}">
      <span class="avatar${c.online ? ' on' : ''}" style="--c:${c.cor}">${c.grupo ? '👥' : escapar(iniciais(c.nome))}</span>
      <b>${escapar(c.nome)}</b><time>${u ? quandoLista(u.em) : ''}</time>
      <span class="prev${dig ? ' dig' : ''}">${escapar(prev)}</span>${c.naoLidas ? `<span class="badge">${c.naoLidas}</span>` : '<span></span>'}
    </li>`;
  }).join('') || '<li class="item"><span class="prev">Nada encontrado</span></li>';
}

/* ---------- Conversa ---------- */
function abrir(id) {
  atual = id; const c = conv(id); c.naoLidas = 0; respondendo = null; $('#resp-a').hidden = true;
  c.msgs.forEach((m) => { if (m.de === 'eu' && m.status < 3 && !c.grupo) m.status = 3; });
  $('#vazio-conv').hidden = true; $('#app').classList.add('abriu');
  $('#c-avatar').className = 'avatar' + (c.online ? ' on' : ''); $('#c-avatar').style.setProperty('--c', c.cor); $('#c-avatar').textContent = c.grupo ? '👥' : iniciais(c.nome);
  $('#c-nome').textContent = c.nome; $('#busca-conv').hidden = true; $('#busca-msg').value = '';
  salvar(); renderLista(); renderMsgs(); status(); $('#texto').focus();
}
function status() {
  const c = conv(atual); if (!c) return;
  const dig = digitando[c.id], el = $('#c-status');
  el.className = dig ? 'dig' : '';
  el.textContent = dig ? (c.grupo ? `${dig} está digitando…` : 'digitando…') : c.grupo ? `Você, ${c.membros.join(', ')}` : c.online ? 'online' : `visto por último ${diaTexto(c.msgs.at(-1)?.em || Date.now()).toLowerCase()}`;
}
function renderMsgs(rolar = true) {
  const c = conv(atual); if (!c) return;
  const q = $('#busca-msg').value.trim();
  let html = '', diaAnt = '', autorAnt = '';
  c.msgs.forEach((m) => {
    const d = diaTexto(m.em); if (d !== diaAnt) { html += `<div class="dia">${d}</div>`; diaAnt = d; autorAnt = ''; }
    const minha = m.de === 'eu', cit = m.resp && c.msgs.find((x) => x.id === m.resp);
    const tique = minha ? `<span class="lido${m.status >= 3 ? ' azul' : ''}" aria-label="${m.status >= 3 ? 'lida' : m.status === 2 ? 'entregue' : 'enviada'}">${m.status >= 2 ? '✓✓' : '✓'}</span>` : '';
    const achou = q && m.txt.toLowerCase().includes(q.toLowerCase());
    html += `<div class="msg${minha ? ' minha' : ''}${autorAnt === m.de ? ' seguida' : ''}${m.reacao ? ' tem-reacao' : ''}${achou ? ' destaque' : ''}" data-id="${m.id}" tabindex="0">
      ${c.grupo && !minha && autorAnt !== m.de ? `<span class="autor" style="color:${corMembro(m.de)}">${escapar(m.de)}</span>` : ''}
      ${cit ? `<div class="cit"><b>${escapar(autorNome(c, cit))}</b>${escapar(cit.txt.slice(0, 90))}</div>` : ''}
      <p class="${soEmoji(m.txt) ? 'so-emoji' : ''}">${marcar(m.txt, q)}</p>
      <span class="meta">${hora(m.em)} ${tique}</span>${m.reacao ? `<span class="reacao">${m.reacao}</span>` : ''}</div>`;
    autorAnt = m.de;
  });
  if (digitando[c.id]) html += '<div class="digitando" aria-label="digitando"><i></i><i></i><i></i></div>';
  $('#mensagens').innerHTML = html;
  if (q) { const n = $$('.msg.destaque').length; $('#busca-res').textContent = n ? `${n} encontrada${n > 1 ? 's' : ''}` : 'nada'; $('.msg.destaque')?.scrollIntoView({ block: 'center' }); }
  else if (rolar) $('#mensagens').scrollTop = 1e9;
}
const corMembro = (n) => ['#e5484d', '#30a46c', '#f08c2a', '#0090ff', '#8e4ec6'][[...n].reduce((s, ch) => s + ch.charCodeAt(0), 0) % 5];

/* ---------- Enviar e respostas automáticas ---------- */
function enviar() {
  const t = $('#texto').value.trim(); if (!t || !atual) return;
  const c = conv(atual), m = { id: uid(), de: 'eu', txt: t, em: Date.now(), status: 1, resp: respondendo };
  c.msgs.push(m); $('#texto').value = ''; ajustarAltura(); respondendo = null; $('#resp-a').hidden = true;
  salvar(); renderMsgs(); renderLista();
  setTimeout(() => { m.status = 2; salvar(); if (atual === c.id) renderMsgs(false); }, 700);
  agendarResposta(c, t);
}
function respostaPara(c, t) {
  const s = t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  if (c.bot) {
    if (/ajuda|help/.test(s)) return 'Posso te contar uma piada, dizer a hora ou dar uma dica do app. É só pedir! 😉';
    if (/piada/.test(s)) return ['Por que o livro de matemática ficou triste? Porque tinha muitos problemas. 📘', 'O que o zero disse para o oito? Que cinto bonito! 😄', 'Qual é o café mais perigoso? O ex-presso. ☕'][Math.floor(Math.random() * 3)];
    if (/hora|horas/.test(s)) return `Agora são ${hora(Date.now())} ⏰`;
    if (/dica/.test(s)) return ['Dica: segure (ou clique com o botão direito) numa mensagem para reagir ou responder.', 'Dica: use a lupa no topo para buscar dentro da conversa.', 'Dica: o botão da lua troca para o tema escuro 🌙'][Math.floor(Math.random() * 3)];
    if (/obrigad|valeu/.test(s)) return 'Por nada! Qualquer coisa, estou por aqui. 💚';
    if (/^(oi|ola|bom dia|boa tarde|boa noite|e ai)/.test(s)) return 'Olá! Como posso ajudar? Tente "ajuda".';
    return 'Não entendi muito bem 🤔 Tente "ajuda", "piada", "hora" ou "dica".';
  }
  if (/\?$/.test(s)) return ['Boa pergunta! Deixa eu ver e já te falo', 'Acho que sim!', 'Hmm, não tenho certeza 🤔', 'Pode ser!'][Math.floor(Math.random() * 4)];
  if (/obrigad|valeu/.test(s)) return 'Imagina! 😊';
  if (/^(oi|ola|e ai|bom dia|boa tarde|boa noite)/.test(s)) return 'Oii! Tudo bem?';
  if (soEmoji(t)) return ['😂', '❤️', '👍', '🔥'][Math.floor(Math.random() * 4)];
  return ['Combinado!', 'Entendi 👍', 'Show, depois me conta', 'Haha boa', 'Perfeito, valeu!', 'Beleza!'][Math.floor(Math.random() * 6)];
}
function agendarResposta(c, t) {
  if (!c.online && !c.grupo && !c.bot && Math.random() < 0.5) return; // nem todo mundo responde na hora
  const quem = c.grupo ? c.membros[Math.floor(Math.random() * c.membros.length)] : 'ela';
  setTimeout(() => {
    c.msgs.forEach((m) => { if (m.de === 'eu') m.status = 3; });
    digitando[c.id] = c.grupo ? quem : true; atualizar(c);
    const txt = respostaPara(c, t);
    setTimeout(() => {
      delete digitando[c.id];
      c.msgs.push({ id: uid(), de: quem, txt, em: Date.now() });
      if (atual !== c.id) c.naoLidas++;
      salvar(); atualizar(c);
    }, 900 + Math.min(2500, txt.length * 35));
  }, 1200 + Math.random() * 800);
}
function atualizar(c) { renderLista(); if (atual === c.id) { renderMsgs(); status(); } }

/* ---------- Menu da mensagem ---------- */
const menu = $('#menu-msg');
let alvo = null;
$('#reacoes').innerHTML = REACOES.map((r) => `<button data-reacao="${r}" aria-label="Reagir com ${r}">${r}</button>`).join('');
function abrirMenu(el, x, y) {
  alvo = conv(atual).msgs.find((m) => m.id === el.dataset.id); if (!alvo) return;
  menu.hidden = false;
  const w = menu.offsetWidth, h = menu.offsetHeight;
  menu.style.left = Math.min(x, innerWidth - w - 8) + 'px'; menu.style.top = Math.min(y, innerHeight - h - 8) + 'px';
  menu.querySelector('button').focus();
}
$('#mensagens').addEventListener('contextmenu', (e) => { const el = e.target.closest('.msg'); if (!el) return; e.preventDefault(); abrirMenu(el, e.clientX, e.clientY); });
let pressao;
$('#mensagens').addEventListener('pointerdown', (e) => { const el = e.target.closest('.msg'); if (!el || e.pointerType === 'mouse') return; pressao = setTimeout(() => abrirMenu(el, e.clientX, e.clientY), 450); });
['pointerup', 'pointermove', 'pointercancel'].forEach((t) => $('#mensagens').addEventListener(t, () => clearTimeout(pressao)));
$('#mensagens').addEventListener('dblclick', (e) => { const el = e.target.closest('.msg'); if (!el) return; const m = conv(atual).msgs.find((x) => x.id === el.dataset.id); m.reacao = m.reacao === '❤️' ? null : '❤️'; salvar(); renderMsgs(false); });
$('#mensagens').addEventListener('keydown', (e) => { const el = e.target.closest('.msg'); if (el && (e.key === 'Enter' || e.key === 'ContextMenu')) { const r = el.getBoundingClientRect(); abrirMenu(el, r.left + 20, r.bottom); } });
menu.addEventListener('click', async (e) => {
  const b = e.target.closest('button'); if (!b || !alvo) return;
  const c = conv(atual);
  if (b.dataset.reacao) alvo.reacao = alvo.reacao === b.dataset.reacao ? null : b.dataset.reacao;
  if (b.dataset.acao === 'responder') { respondendo = alvo.id; $('#resp-nome').textContent = autorNome(c, alvo); $('#resp-texto').textContent = alvo.txt; $('#resp-a').hidden = false; $('#texto').focus(); }
  if (b.dataset.acao === 'copiar') { try { await navigator.clipboard.writeText(alvo.txt); toast('Mensagem copiada'); } catch { toast('Não foi possível copiar'); } }
  if (b.dataset.acao === 'apagar') { const i = c.msgs.indexOf(alvo), m = alvo; c.msgs.splice(i, 1); toast('Mensagem apagada', () => { c.msgs.splice(i, 0, m); salvar(); renderMsgs(false); renderLista(); }); }
  menu.hidden = true; salvar(); renderMsgs(false); renderLista();
});
document.addEventListener('pointerdown', (e) => { if (!menu.hidden && !e.target.closest('#menu-msg')) menu.hidden = true; if (!$('#emojis').hidden && !e.target.closest('#emojis, #emoji-btn')) fecharEmojis(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { menu.hidden = true; fecharEmojis(); if (respondendo) { respondendo = null; $('#resp-a').hidden = true; } } });

/* ---------- Composição ---------- */
function ajustarAltura() { const t = $('#texto'); t.style.height = 'auto'; t.style.height = Math.min(140, t.scrollHeight) + 'px'; }
$('#texto').addEventListener('input', ajustarAltura);
$('#texto').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(); } });
$('#compor').addEventListener('submit', (e) => { e.preventDefault(); enviar(); });
$('#emojis').innerHTML = EMOJIS.map((x) => `<button type="button">${x}</button>`).join('');
function fecharEmojis() { $('#emojis').hidden = true; $('#emoji-btn').setAttribute('aria-expanded', 'false'); }
$('#emoji-btn').addEventListener('click', () => { const ab = $('#emojis').hidden; $('#emojis').hidden = !ab; $('#emoji-btn').setAttribute('aria-expanded', ab); });
$('#emojis').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; const t = $('#texto'), p = t.selectionStart ?? t.value.length; t.value = t.value.slice(0, p) + b.textContent + t.value.slice(t.selectionEnd ?? p); t.focus(); t.selectionStart = t.selectionEnd = p + b.textContent.length; ajustarAltura(); });
$('#resp-fechar').addEventListener('click', () => { respondendo = null; $('#resp-a').hidden = true; });

/* ---------- Navegação ---------- */
$('#lista').addEventListener('click', (e) => { const li = e.target.closest('.item[data-id]'); if (li) abrir(li.dataset.id); });
$('#lista').addEventListener('keydown', (e) => { const li = e.target.closest('.item[data-id]'); if (li && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); abrir(li.dataset.id); } });
$('#voltar').addEventListener('click', () => { $('#app').classList.remove('abriu'); atual = null; renderLista(); });
$$('[data-aba]').forEach((b) => b.addEventListener('click', () => { aba = b.dataset.aba; $$('[data-aba]').forEach((x) => x.setAttribute('aria-selected', x === b)); renderLista(); }));
$('#busca').addEventListener('input', (e) => { buscaGlobal = e.target.value.trim(); renderLista(); });
$('#c-buscar').addEventListener('click', () => { const bc = $('#busca-conv'); bc.hidden = !bc.hidden; if (!bc.hidden) $('#busca-msg').focus(); else { $('#busca-msg').value = ''; renderMsgs(); } });
$('#busca-msg').addEventListener('input', () => renderMsgs(false));
let limparT;
$('#c-limpar').addEventListener('click', (e) => {
  const b = e.currentTarget;
  if (!b.dataset.conf) { b.dataset.conf = '1'; b.textContent = '⚠️'; toast('Toque de novo para limpar a conversa'); limparT = setTimeout(() => { delete b.dataset.conf; b.textContent = '🗑'; }, 3000); return; }
  clearTimeout(limparT); delete b.dataset.conf; b.textContent = '🗑';
  const c = conv(atual), antes = c.msgs; c.msgs = []; salvar(); renderMsgs(); renderLista();
  toast('Conversa limpa', () => { c.msgs = antes; salvar(); renderMsgs(); renderLista(); });
});
$('#tema').addEventListener('click', () => { tema = tema === 'escuro' ? 'claro' : 'escuro'; banco.salvar('pm_tema', tema); aplicarTema(); });
function aplicarTema() { document.body.classList.toggle('escuro', tema === 'escuro'); $('#tema').textContent = tema === 'escuro' ? '☀️' : '🌙'; }

let toastT;
function toast(msg, desfazer) {
  const t = $('#toast'); t.innerHTML = `${escapar(msg)}${desfazer ? ' <button class="icone" style="width:auto;height:auto;color:inherit;font-weight:800;padding:0 4px">Desfazer</button>' : ''}`; t.hidden = false;
  if (desfazer) t.querySelector('button').onclick = () => { desfazer(); t.hidden = true; };
  clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 3500);
}
aplicarTema(); renderLista();
if (innerWidth > 760) abrir(conversas.sort((a, b) => (b.msgs.at(-1)?.em || 0) - (a.msgs.at(-1)?.em || 0))[0].id);
