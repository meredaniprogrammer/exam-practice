// Main logic for Practice Test
(function(){
  const testLength = 40; // evaluate first 40 questions
  const pageSize = 20;

  // DOM
  const topicSelect = document.getElementById('topicSelect');
  const fileSelect = document.getElementById('fileSelect');
  const startBtn = document.getElementById('startBtn');
  const pinOverlay = document.getElementById('pinOverlay');
  const pinInput = document.getElementById('pinInput');
  const pinSubmit = document.getElementById('pinSubmit');
  const pinMessage = document.getElementById('pinMessage');
  const front = document.getElementById('front');
  const practice = document.getElementById('practice');
  const result = document.getElementById('result');
  const questionsForm = document.getElementById('questionsForm');
  const nextBtn = document.getElementById('nextBtn');
  const prevBtn = document.getElementById('prevBtn');
  const backHome = document.getElementById('backHome');
  const pageNum = document.getElementById('pageNum');
  const scoreCircle = document.getElementById('scoreCircle');
  const scoreValue = document.getElementById('scoreValue');
  const scoreMessage = document.getElementById('scoreMessage');
  const retryBtn = document.getElementById('retryBtn');
  const homeBtn = document.getElementById('homeBtn');
  const reviewBtn = document.getElementById('reviewBtn');
  const reviewSection = document.getElementById('review');
  const reviewContent = document.getElementById('reviewContent');
  const backToResult = document.getElementById('backToResult');

  let questions = [];
  let answers = []; // selected option(s) per question: number|null for single-answer, array for multi-answer
  let currentPage = 0;
  // Access control: allowedTopics === undefined means not authenticated yet
  // allowedTopics === null means admin (all topics)
  // allowedTopics === Array means only these topic names are allowed
  let allowedTopics = undefined;

  // Load manifest and populate topic/file selectors
  let manifest = null;
  async function loadManifest(){
    // Prefer fetching a hosted manifest (Netlify/static host). If that fails, fall back to embedded manifest.
    try{
      const res = await fetch('manifest.json');
      if(!res.ok) throw new Error('manifest.json not available');
      manifest = await res.json();
      // Do not populate until PIN auth grants access
      return;
    }catch(err){
      // fallback to embedded manifest (useful when opening file:// locally)
      if(window && window.__MANIFEST__){
        manifest = window.__MANIFEST__;
        // Wait for PIN auth to populate topics
        return;
      }
      console.warn('Could not load manifest.json and no embedded manifest found. Run `node build-manifest.js` or deploy manifest.json to the site.');
    }
  }

  function populateTopics(){
    // Only populate after PIN authentication
    if(typeof allowedTopics === 'undefined') return;
    topicSelect.innerHTML = '<option value="">Select topic</option>';
    const topics = manifest && manifest.topics ? Object.keys(manifest.topics) : [];
    const shown = (allowedTopics === null) ? topics : topics.filter(t=> allowedTopics.includes(t));
    shown.forEach(t=>{
      const opt = document.createElement('option'); opt.value = t; opt.textContent = t; topicSelect.appendChild(opt);
    });
  }

  let currentTopic = '';
  topicSelect.addEventListener('change',()=>{
    const t = topicSelect.value;
    currentTopic = t;
    fileSelect.innerHTML = '<option value="">Select file</option>';
    fileSelect.disabled = true;
    startBtn.disabled = true;
    if(!t) return;
    const list = (manifest && manifest.topics && manifest.topics[t]) || [];
    list.forEach((f,idx)=>{
      const opt = document.createElement('option');
      opt.value = f.path;
      // display only a human-friendly short label (first three words, Title Case)
      opt.textContent = f.label;
      opt.dataset.index = String(idx);
      fileSelect.appendChild(opt);
    });
    fileSelect.disabled = false;
  });

  // PIN authentication
  function authenticatePin(pin){
    // keep as strings to preserve leading zeros
    if(pin === '0101') return null; // admin: null => all topics
    if(pin === '1997') return ['CAMS'];
    if(pin === '1993') return ['Nursing'];
    return false;
  }

  function showPinMessage(msg, isError=true){
    pinMessage.textContent = msg;
    pinMessage.style.color = isError ? '#7f1d1d' : '#065f46';
  }

  pinSubmit.addEventListener('click',()=>{
    const pin = (pinInput && pinInput.value) ? String(pinInput.value).trim() : '';
    const result = authenticatePin(pin);
    if(result === false){
      showPinMessage('Invalid PIN. Try again.');
      return;
    }
    // set allowed topics and populate
    allowedTopics = result; // null means admin
    showPinMessage('Access granted.', false);
    // hide overlay
    if(pinOverlay) pinOverlay.style.display = 'none';
    document.body.classList.add('is-authenticated');
    // populate topics now that we have permission
    populateTopics();
  });

  // allow Enter key in input
  if(pinInput){
    pinInput.addEventListener('keydown',(e)=>{ if(e.key === 'Enter'){ e.preventDefault(); pinSubmit.click(); } });
  }

  fileSelect.addEventListener('change',()=>{ startBtn.disabled = !fileSelect.value; });

  startBtn.addEventListener('click', async ()=>{
    const path = fileSelect.value;
    if(!path) return alert('Please select a file from the list');
    // If manifest entry has inlined content, use it (works over file:// and offline)
    let entry = null;
    if(currentTopic && manifest && manifest.topics && Array.isArray(manifest.topics[currentTopic])){
      const opt = fileSelect.selectedOptions[0];
      const idx = opt && opt.dataset && opt.dataset.index ? Number(opt.dataset.index) : null;
      if(idx !== null && manifest.topics[currentTopic][idx]) entry = manifest.topics[currentTopic][idx];
    }
    try{
      let text = null;
      if(entry && typeof entry.content === 'string' && entry.content.length>0){
        text = entry.content;
      } else {
        const tried = [];
        const variants = [path, './' + path, '/' + path, window.location.origin + '/' + path];
        let res = null;
        let triedDetails = [];
        for(const v of variants){
          const url = encodeURI(v);
          tried.push(url);
          try{
            res = await fetch(url, {cache:'no-store'});
            triedDetails.push({url, status: res.status});
            if(res.ok) break;
          }catch(e){
            triedDetails.push({url, error: e.message});
          }
        }
        if(!res || !res.ok) {
          const info = triedDetails.map(d => d.status ? `${d.url} -> ${d.status}` : `${d.url} -> error: ${d.error}`).join('\n');
          throw new Error('Could not fetch file. Tried:\n' + info);
        }
        text = await res.text();
      }
      questions = parseQuestions(String(text));
      if(!questions.length) return alert('No questions parsed from file. Check format.');
      shuffleQuestions(questions);
      answers = Array(questions.length).fill(null);
      currentPage = 0;
      showPractice();
      renderPage();
    }catch(err){
      // show helpful diagnostics to the user
      const msg = 'Error loading file: ' + err.message + '\nPlease check that the file exists at one of the attempted URLs and that `manifest.json` contains the correct path. If you deployed to a subpath, ensure files are accessible under the site root.';
      alert(msg);
      console.error('File fetch diagnostics:', err);
    }
  });

  // init
  loadManifest();

  backHome.addEventListener('click',()=>{ showFront(); });
  homeBtn.addEventListener('click',()=>{ showFront(); });
  retryBtn.addEventListener('click',()=>{ shuffleQuestions(questions); answers = Array(questions.length).fill(null); currentPage = 0; showPractice(); renderPage(); });
  reviewBtn.addEventListener('click',()=>{ renderReview(); showReview(); });
  backToResult.addEventListener('click',()=>{ showResult(); });

  prevBtn.addEventListener('click',()=>{
    if(currentPage>0) { currentPage--; renderPage(); try{ window.scrollTo({top:0,behavior:'auto'}); }catch(e){ window.scrollTo(0,0); } }
  });

  nextBtn.addEventListener('click',()=>{
    const maxPage = Math.ceil(Math.min(questions.length, testLength)/pageSize)-1;
    if(currentPage < maxPage){ currentPage++; renderPage(); try{ window.scrollTo({top:0,behavior:'auto'}); }catch(e){ window.scrollTo(0,0); } }
    else { // final: compute results
      showResult();
    }
  });

  // ensure when navigating pages we scroll to top
  function goToPage(page){
    currentPage = page;
    renderPage();
    try{ window.scrollTo({top:0,behavior:'auto'}); }catch(e){ window.scrollTo(0,0); }
  }

  function showFront(){ front.classList.remove('hidden'); practice.classList.add('hidden'); result.classList.add('hidden'); reviewSection.classList.add('hidden'); }
  function showPractice(){ front.classList.add('hidden'); practice.classList.remove('hidden'); result.classList.add('hidden'); reviewSection.classList.add('hidden'); }
  function showResult(){ front.classList.add('hidden'); practice.classList.add('hidden'); result.classList.remove('hidden'); reviewSection.classList.add('hidden'); computeAndShow(); }
  function showReview(){ front.classList.add('hidden'); practice.classList.add('hidden'); result.classList.add('hidden'); reviewSection.classList.remove('hidden'); }

  function renderPage(){
    const start = currentPage * pageSize;
    const end = Math.min(start + pageSize, questions.length, testLength);
    questionsForm.innerHTML = '';
    for(let i=start;i<end;i++){
      const q = questions[i];
      const qWrap = document.createElement('fieldset');
      qWrap.className = 'question';
      const legend = document.createElement('legend');
      legend.innerHTML = `<span class="qnum">${i+1}.</span> ${escapeHtml(q.text)}`;
      qWrap.appendChild(legend);
      const opts = document.createElement('div');
      opts.className = 'options';
      q.options.forEach((opt, idx)=>{
        const id = `q${i}_opt${idx}`;
        const label = document.createElement('label');
        label.className = 'option-label';
        const input = document.createElement('input');
        const multi = Array.isArray(q.correctIndices) && q.correctIndices.length > 1;
        input.type = multi ? 'checkbox' : 'radio';
        input.name = `q${i}`;
        input.id = id;
        if(multi){ input.checked = Array.isArray(answers[i]) && answers[i].includes(idx); }
        else { input.checked = answers[i] === idx; }
        input.addEventListener('change',(e)=>{
          if(multi){
            if(!Array.isArray(answers[i])) answers[i] = [];
            if(input.checked){
              if(!answers[i].includes(idx)) answers[i].push(idx);
            } else {
              const p = answers[i].indexOf(idx);
              if(p>-1) answers[i].splice(p,1);
              if(answers[i].length === 0) answers[i] = null;
            }
          } else {
            answers[i] = input.checked ? idx : null;
          }
        });
        const span = document.createElement('span');
        span.className = 'option-text';
        span.innerText = `${String.fromCharCode(65+idx)}. ${opt}`;
        label.appendChild(input);
        label.appendChild(span);
        opts.appendChild(label);
      });
      qWrap.appendChild(opts);
      questionsForm.appendChild(qWrap);
    }

    // update nav
    pageNum.textContent = String(currentPage+1);
    prevBtn.disabled = currentPage === 0;
    const maxPage = Math.ceil(Math.min(questions.length, testLength)/pageSize)-1;
    nextBtn.textContent = currentPage < maxPage ? 'Next' : 'Submit';
  }

  // Fisher-Yates shuffle
  function shuffle(array){
    for(let i = array.length - 1; i > 0; i--){
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }

  // Shuffle questions array and shuffle options per question while preserving correctIndex/indices
  function shuffleQuestions(qs){
    shuffle(qs);
    qs.forEach(q=>{
      if(!Array.isArray(q.options) || q.options.length <= 1) return;
      const originalIndices = Array.isArray(q.correctIndices) ? q.correctIndices.slice() : (typeof q.correctIndex === 'number' ? [q.correctIndex] : []);
      const order = q.options.map((_,i)=>i);
      shuffle(order);
      const newOptions = order.map(i=>q.options[i]);
      let newCorrectIndices = [];
      originalIndices.forEach(orig => {
        const ni = order.indexOf(orig);
        if(ni > -1) newCorrectIndices.push(ni);
      });
      q.options = newOptions;
      if(newCorrectIndices.length === 0) q.correctIndices = [];
      else q.correctIndices = newCorrectIndices.sort((a,b)=>a-b);
    });
  }

  function computeAndShow(){
    const limit = Math.min(questions.length, testLength);
    let correct = 0;
    for(let i=0;i<limit;i++){
      const q = questions[i];
      const correctIdxs = Array.isArray(q.correctIndices) ? q.correctIndices : (typeof q.correctIndex === 'number' ? [q.correctIndex] : []);
      if(correctIdxs.length <= 1){
        // single-answer scoring
        if(answers[i] != null && answers[i] === correctIdxs[0]) correct++;
      } else {
        // multi-answer: require selected set to exactly match correct set
        if(Array.isArray(answers[i])){
          const sel = answers[i].slice().sort((a,b)=>a-b);
          if(sel.length === correctIdxs.length && sel.every((v,idx)=>v === correctIdxs[idx])) correct++;
        }
      }
    }
    const pct = Math.round((correct / limit) * 100);
    scoreValue.textContent = `${pct}%`;
    const pass = pct >= 70;
    scoreCircle.style.background = `conic-gradient(${pass ? '#2ecc71' : '#e74c3c'} ${pct}%, #eee ${pct}%)`;
    scoreMessage.textContent = pass ? `Pass — ${correct} / ${limit} correct` : `Fail — ${correct} / ${limit} correct`;
  }

  function renderReview(){
    const limit = Math.min(questions.length, testLength);
    reviewContent.innerHTML = '';
    for(let i=0;i<limit;i++){
      const q = questions[i];
      const qWrap = document.createElement('fieldset');
      qWrap.className = 'question review-question';
      const legend = document.createElement('legend');
      legend.innerHTML = `<span class="qnum">${i+1}.</span> ${escapeHtml(q.text)}`;
      qWrap.appendChild(legend);
      const opts = document.createElement('div');
      opts.className = 'options';
      q.options.forEach((opt, idx)=>{
        const label = document.createElement('label');
        label.className = 'option-label review-option';
        const span = document.createElement('span');
        span.className = 'option-text';
        span.innerText = `${String.fromCharCode(65+idx)}. ${opt}`;
        // mark correct / incorrect / selected (supports multi-answer)
        const correctIdxs = Array.isArray(q.correctIndices) ? q.correctIndices : (typeof q.correctIndex === 'number' ? [q.correctIndex] : []);
        const isCorrect = correctIdxs.includes(idx);
        const isSelected = (Array.isArray(answers[i]) && answers[i].includes(idx)) || answers[i] === idx;
        if(isCorrect) label.classList.add('correct');
        if(isSelected) label.classList.add('selected');
        if(isSelected && !isCorrect) label.classList.add('incorrect');
        label.appendChild(span);
        opts.appendChild(label);
      });
      qWrap.appendChild(opts);
      reviewContent.appendChild(qWrap);
    }
  }

  // Very tolerant parser for a simple .txt format
  // Expected pattern:
  // 1. Question text
  // A. Option one
  // B. Option two *  (asterisk marks correct) OR B. Option (correct)
  function parseQuestions(text){
    const lines = text.replace(/\r/g,'').split('\n');
    const qs = [];
    let curQ = null;
    const optionRegex = /^[\s]*([A-E])(?:[\.\)])\s*(.*)$/i;
    const qRegex = /^[\s]*\d+\s*[\.|\)]\s*(.*)$/;
    for(let raw of lines){
      const line = raw.trim();
      if(!line) continue;
      const qMatch = line.match(qRegex);
      if(qMatch){
        if(curQ) qs.push(curQ);
        curQ = { text: qMatch[1].trim(), options: [], correctIndices: [] };
        continue;
      }
      const oMatch = raw.match(optionRegex);
      if(oMatch && curQ){
        let optText = oMatch[2].trim();
        let isCorrect = false;
        if(/\*|\(correct\)|✔|\u2714/.test(optText)) isCorrect = true;
        optText = optText.replace(/\*|\(correct\)|✔|\u2714/ig,'').trim();
        curQ.options.push(optText);
        if(isCorrect) curQ.correctIndices.push(curQ.options.length-1);
        continue;
      }
      // fallback: if line doesn't match patterns, maybe it's continuation of question or option
      if(curQ && curQ.options.length===0){
        // continuation of question
        curQ.text += ' ' + line;
      } else if(curQ && curQ.options.length>0){
        // continuation of last option
        curQ.options[curQ.options.length-1] += ' ' + line;
      }
    }
    if(curQ) qs.push(curQ);

    // Normalize: ensure each question has exactly options length 2-5; discard incomplete
    return qs.filter(q=>q.options.length>=2).map(q=>{
      // ensure a correctIndices array exists for each question
      if(!Array.isArray(q.correctIndices)) q.correctIndices = [];
      return q;
    });
  }

  function escapeHtml(str){ return str.replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[s]); }

  // no sample link behavior

})();
