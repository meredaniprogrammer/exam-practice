// Main logic for Practice Test
(function(){
  const testLength = 40; // evaluate first 40 questions
  const pageSize = 20;

  // DOM
  const fileInput = document.getElementById('fileInput');
  const startBtn = document.getElementById('startBtn');
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
  const bookLink = document.getElementById('bookLink');
  const reviewBtn = document.getElementById('reviewBtn');
  const reviewSection = document.getElementById('review');
  const reviewContent = document.getElementById('reviewContent');
  const backToResult = document.getElementById('backToResult');

  let questions = [];
  let answers = []; // selected option(s) per question: number|null for single-answer, array for multi-answer
  let currentPage = 0;

  fileInput.addEventListener('change',()=>{
    startBtn.disabled = !fileInput.files.length;
  });

  startBtn.addEventListener('click',()=>{
    const f = fileInput.files[0];
    if(!f) return alert('Choose a .txt file with questions');
    const reader = new FileReader();
    reader.onload = e => {
      questions = parseQuestions(String(e.target.result));
      if(!questions.length) return alert('No questions parsed from file. Check format.');
      // shuffle questions and their options so each run is randomized
      shuffleQuestions(questions);
      answers = Array(questions.length).fill(null);
      currentPage = 0;
      showPractice();
      renderPage();
    };
    reader.readAsText(f);
  });

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

  function showFront(){ front.classList.remove('hidden'); practice.classList.add('hidden'); result.classList.add('hidden'); }
  function showPractice(){ front.classList.add('hidden'); practice.classList.remove('hidden'); result.classList.add('hidden'); }
  function showResult(){ front.classList.add('hidden'); practice.classList.add('hidden'); result.classList.remove('hidden'); computeAndShow(); }
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

  // Expose simple behavior to open sample link if file not provided
  bookLink.addEventListener('click', ()=>{});

})();
