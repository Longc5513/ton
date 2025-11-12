const { ethers } = require('ethers');

// ===== CẤU HÌNH =====
const RPC    = 'https://dream-rpc.somnia.network';
const PK     = '0x6c43ca476957e0d06b1e384a5e';
const ROUTER = '0xea5b1f14e523eadbcf943f35b32c2b6b2f31';      // router Somnia
const NIA    = '0xf2f773753cebefaf9b68b841d80c089311';      // NIA ERC20

const AMT_STT  = 5;        // STT (native) mỗi lượt
const AMT_NIA  = 5;        // NIA mỗi lượt
const SLIPPAGE_BPS = 300;  // 3% slippage
const DELAY   = 15000;     // ms
const DEC_NATIVE = 18;     // decimals của STT native
const DEC_NIA    = 6;      // decimals của NIA
// ===================== 

const provider = new ethers.JsonRpcProvider(RPC);
const wallet   = new ethers.Wallet(PK, provider);

const routerAbi = [
  'function WETH() view returns (address)',
  'function factory() view returns (address)',
  'function getAmountsOut(uint amountIn,address[] path) view returns (uint[] amounts)',
  'function swapExactETHForTokens(uint amountOutMin,address[] path,address to,uint deadline) payable returns (uint[])',
  'function swapExactTokensForETH(uint amountIn,uint amountOutMin,address[] path,address to,uint deadline) returns (uint[])',
  'function swapExactETHForTokensSupportingFeeOnTransferTokens(uint amountOutMin,address[] path,address to,uint deadline) payable',
  'function swapExactTokensForETHSupportingFeeOnTransferTokens(uint amountIn,uint amountOutMin,address[] path,address to,uint deadline)'
];
const erc20Abi = [
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address,address) view returns (uint256)',
  'function approve(address,uint256) returns (bool)'
];

const router = new ethers.Contract(ROUTER, routerAbi, wallet);
const nia    = new ethers.Contract(NIA, erc20Abi, wallet);
const MAX = 2n**256n - 1n;
const sleep = ms => new Promise(r=>setTimeout(r,ms));

const pct = (x,bps)=> (x * BigInt(10000 - bps)) / 10000n;

async function ensureApproveNIA(needWei){
  const cur = await nia.allowance(wallet.address, ROUTER);
  if (cur >= needWei) return;
  const tx = await nia.approve(ROUTER, MAX);(async () => {
  console.log('address:', wallet.address);
  while (true) {
    try {
      await swapSTTtoNIA(AMT_STT);
      await sleep(DELAY);
      await swapNIAtoSTT(AMT_NIA);
      await sleep(DELAY);
    } catch (e) {
      console.error('ERR', e.reason || e.message);
      await sleep(30000);
    }
  }
})();
  console.log('approve NIA:', tx.hash);
  await tx.wait();
}

async function quoteOut(amountInWei, path){
  try {
    const amounts = await router.getAmountsOut(amountInWei, path);
    return amounts[amounts.length-1];
  } catch (e) {
    console.log('quote failed:', e.reason || e.message);
    return 0n;
  }
}

async function swapSTTtoNIA(amountSTT){
  const WSTT = await router.WETH();
  const inWei = ethers.parseUnits(String(amountSTT), DEC_NATIVE);
  const outEst = await quoteOut(inWei, [WSTT, NIA]);
  if (outEst === 0n) throw new Error('path WSTT->NIA không khả dụng');
  const minOut = pct(outEst, SLIPPAGE_BPS);

  try {
    const tx = await router.swapExactETHForTokens(
      minOut, [WSTT, NIA], wallet.address, Math.floor(Date.now()/1000)+600,
      { value: inWei }
    );
    console.log('STT->NIA tx:', tx.hash);
    await tx.wait(); console.log('STT->NIA done');
  } catch (e) {
    console.log('swapExactETHForTokens revert:', e.reason || e.message);
    const tx2 = await router.swapExactETHForTokensSupportingFeeOnTransferTokens(
      minOut, [WSTT, NIA], wallet.address, Math.floor(Date.now()/1000)+600,
      { value: inWei }
    );
    console.log('STT->NIA (supporting) tx:', tx2.hash);
    await tx2.wait(); console.log('STT->NIA (supporting) done');
  }
}

async function swapNIAtoSTT(amountNIA){
  const WSTT = await router.WETH();
  const inWei = ethers.parseUnits(String(amountNIA), DEC_NIA);
  const outEst = await quoteOut(inWei, [NIA, WSTT]);
  if (outEst === 0n) throw new Error('path NIA->WSTT không khả dụng');
  const minOut = pct(outEst, SLIPPAGE_BPS);

  await ensureApproveNIA(inWei);

  try {
    const tx = await router.swapExactTokensForETH(
      inWei, minOut, [NIA, WSTT], wallet.address, Math.floor(Date.now()/1000)+600
    );
    console.log('NIA->STT tx:', tx.hash);
    await tx.wait(); console.log('NIA->STT done');
  } catch (e) {
    console.log('swapExactTokensForETH revert:', e.reason || e.message);
    const tx2 = await router.swapExactTokensForETHSupportingFeeOnTransferTokens(
      inWei, minOut, [NIA, WSTT], wallet.address, Math.floor(Date.now()/1000)+600
    );
    console.log('NIA->STT (supporting) tx:', tx2.hash);
    await tx2.wait(); console.log('NIA->STT (supporting) done');
  }
}

(async () => {
  console.log('address:', wallet.address);
  while (true) {
    try {
      await swapSTTtoNIA(AMT_STT);
      await sleep(DELAY);
      await swapNIAtoSTT(AMT_NIA);
      await sleep(DELAY);
    } catch (e) {
      console.error('ERR', e.reason || e.message);
      await sleep(30000);
    }
  }
})();
(async () => {
  console.log('address:', wallet.address);
  while (true) {
    try {
      await swapSTTtoNIA(AMT_STT);
      await sleep(DELAY);
      await swapNIAtoSTT(AMT_NIA);
      await sleep(DELAY);
    } catch (e) {
      console.error('ERR', e.reason || e.message);
      await sleep(30000);
    }
  }
})();







