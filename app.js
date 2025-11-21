// Simple demo: all data in localStorage. Replace calls with real backend for production.

// Utils
function uid(len=8){ return Math.random().toString(16).slice(2,2+len) }
function nowTs(){ return new Date().toISOString() }

// Simple mock "address" generator
function mkAddress(phone){
  // deterministic-ish: hash-like string from phone
  let s = Array.from(phone).reduce((a,c)=>a+(c.charCodeAt(0)%16).toString(16),'');
  return '0x'+s.slice(0,36).padEnd(40,'0');
}

// Storage helpers
const DB = {
  get(key){ return JSON.parse(localStorage.getItem(key) || 'null') },
  set(key,val){ localStorage.setItem(key, JSON.stringify(val)) }
}

// Init storage spaces
if(!DB.get('laam_users')) DB.set('laam_users',{}); // phone->{address,createdAt}
if(!DB.get('laam_blocks')) DB.set('laam_blocks',[]);
if(!DB.get('laam_txs')) DB.set('laam_txs',[]);

// --- UI bindings
const phoneInput = document.getElementById('phoneInput');
const reqOtpBtn = document.getElementById('reqOtpBtn');
const otpArea = document.getElementById('otpArea');
const otpInput = document.getElementById('otpInput');
const verifyOtpBtn = document.getElementById('verifyOtpBtn');
const regStatus = document.getElementById('regStatus');

const walletSection = document.getElementById('wallet');
const mePhoneSpan = document.getElementById('mePhone');
const meAddrCode = document.getElementById('meAddr');
const meBalSpan = document.getElementById('meBal');

const sendSection = document.getElementById('send');
const toPhone = document.getElementById('toPhone');
const amount = document.getElementById('amount');
const memo = document.getElementById('memo');
const sendBtn = document.getElementById('sendBtn');
const sendStatus = document.getElementById('sendStatus');

const blocksList = document.getElementById('blocksList');
const createBlockBtn = document.getElementById('createBlockBtn');

// In-memory OTP store (demo only)
let otpStore = {};

// Current session
let session = DB.get('laam_session') || null;
if(session){ showWallet(session.phone) }

// --- OTP Request (simulated)
reqOtpBtn.addEventListener('click', ()=>{
  const phone = phoneInput.value.trim();
  if(!phone){ regStatus.textContent = 'Geli phone sax ah'; return; }
  // generate OTP
  const otp = (Math.floor(100000 + Math.random()*900000)).toString();
  otpStore[phone] = { otp, ts: Date.now() };
  // In production: send OTP via SMS provider (Twilio, Vonage, local aggregator) using backend
  console.log(`[Mock SMS] OTP for ${phone}: ${otp}`);
  regStatus.textContent = 'OTP waa la diray (simulated). Fiiri console log.';
  otpArea.classList.remove('hidden');
});

// Verify OTP (simulated)
verifyOtpBtn.addEventListener('click', ()=>{
  const phone = phoneInput.value.trim();
  const code = otpInput.value.trim();
  if(!otpStore[phone]){ regStatus.textContent = 'OTP lama diro ama dhacay'; return; }
  if(otpStore[phone].otp !== code){ regStatus.textContent = 'OTP khalad ah'; return; }

  // create user
  const users = DB.get('laam_users') || {};
  if(!users[phone]){
    const addr = mkAddress(phone);
    users[phone] = { address: addr, createdAt: nowTs(), balance: 1000 }; // give demo balance
    DB.set('laam_users', users);
  }

  // create a session (simple)
  session = { phone, address: users[phone].address, createdAt: nowTs() };
  DB.set('laam_session', session);

  regStatus.textContent = 'Verified! Wallet created.';
  otpArea.classList.add('hidden');
  otpInput.value = '';
  phoneInput.value = '';
  showWallet(session.phone);
});

// Show wallet UI
function showWallet(phone){
  const users = DB.get('laam_users') || {};
  const u = users[phone];
  if(!u) return;
  walletSection.classList.remove('hidden');
  sendSection.classList.remove('hidden');
  mePhoneSpan.textContent = phone;
  meAddrCode.textContent = u.address;
  meBalSpan.textContent = u.balance;
  renderBlocks();
}

// Send money (mock)
sendBtn.addEventListener('click', ()=>{
  sendStatus.textContent = '';
  const from = session?.phone;
  if(!from){ sendStatus.textContent = 'Fadlan log in marka hore'; return; }
  const to = toPhone.value.trim();
  const amt = Number(amount.value);
  if(!to || !amt || amt<=0){ sendStatus.textContent = 'Geli recipient iyo amount sax ah'; return; }

  const users = DB.get('laam_users') || {};
  if(!users[to]){
    // Option: create pending credit or invite. Here we auto-create recipient with zero balance.
    const addr = mkAddress(to);
    users[to] = { address: addr, createdAt: nowTs(), balance: 0 };
    DB.set('laam_users', users);
    console.log('Recipient auto-created (mock) for demo.');
  }

  const sender = users[from];
  if(sender.balance < amt){ sendStatus.textContent = 'Balance ka ma filna'; return; }

  // create tx
  const tx = {
    txHash: '0x'+uid(12),
    fromAddr: sender.address,
    toAddr: users[to].address,
    fromPhone: from,
    toPhone: to,
    amount: amt,
    memo: memo.value || '',
    ts: nowTs()
  };
  const txs = DB.get('laam_txs') || [];
  txs.push(tx);
  DB.set('laam_txs', txs);

  // deduct/add
  sender.balance -= amt;
  users[to].balance += amt;
  DB.set('laam_users', users);

  // Optionally auto-mine a block containing this tx (for demo)
  createBlock([tx]);

  sendStatus.textContent = `Tx broadcasted (mock): ${tx.txHash}`;
  meBalSpan.textContent = sender.balance;
  toPhone.value = '';
  amount.value = '';
  memo.value = '';
});

// Blocks & simple miner
function createBlock(txsToInclude=[]){
  const blocks = DB.get('laam_blocks') || [];
  const prev = blocks.length ? blocks[blocks.length-1].hash : '0x0';
  const block = {
    index: blocks.length,
    ts: nowTs(),
    prevHash: prev,
    hash: '0x'+uid(20),
    txs: txsToInclude
  };
  blocks.push(block);
  DB.set('laam_blocks', blocks);
  renderBlocks();
}

createBlockBtn.addEventListener('click', ()=> createBlock([]));

function renderBlocks(){
  const blocks = DB.get('laam_blocks') || [];
  blocksList.innerHTML = '';
  for(let b of blocks.slice().reverse()){
    const div = document.createElement('div');
    div.className = 'block';
    div.innerHTML = `<strong>Block #${b.index}</strong> <div>hash: <code>${b.hash}</code></div>
      <div>txs: ${b.txs.length}</div><div>ts: ${b.ts}</div>`;
    // list txs short
    for(let t of b.txs){
      const tdiv = document.createElement('div');
      tdiv.style.marginTop='6px';
      tdiv.textContent = `[${t.txHash}] ${t.fromPhone} → ${t.toPhone} : ${t.amount}`;
      div.appendChild(tdiv);
    }
    blocksList.appendChild(div);
  }
}

// On load: create genesis block if none
if(!(DB.get('laam_blocks') || []).length) createBlock([]);
renderBlocks();
