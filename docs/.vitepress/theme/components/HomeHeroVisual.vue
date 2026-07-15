<script setup lang="ts">
// Static, decorative snippet — no data, no interactivity. It reuses the transcript
// palette (.tx-line / .tx-sN / .tx-prompt from custom.css) so the hero reads as
// "real database run" at a glance. Two sessions grab each other's rows in the wrong
// order and the engine breaks the tie with a real deadlock. Illustrative, not from the ledger.
</script>

<template>
  <div class="hero-visual" aria-hidden="true">
    <div class="hero-visual-bar">
      <span class="dot" /><span class="dot" /><span class="dot" />
      <span class="hero-visual-title">verified transcript</span>
    </div>
    <div class="transcript">
      <pre><code><span class="tx-line tx-s1"><span class="tx-prompt">A&gt;</span> BEGIN;</span>
<span class="tx-line tx-s2"><span class="tx-prompt">B&gt;</span> BEGIN;</span>
<span class="tx-line tx-s1"><span class="tx-prompt">A&gt;</span> UPDATE accounts SET balance = balance - 100 WHERE id = 1;</span>
<span class="tx-line tx-s2"><span class="tx-prompt">B&gt;</span> UPDATE accounts SET balance = balance - 50 WHERE id = 2;</span>
<span class="tx-line tx-s1"><span class="tx-prompt">A&gt;</span> UPDATE accounts SET balance = balance + 100 WHERE id = 2;</span>
<span class="tx-line tx-s1">⏳ A  waiting on B's lock (row id=2)</span>
<span class="tx-line tx-s2"><span class="tx-prompt">B&gt;</span> UPDATE accounts SET balance = balance + 50 WHERE id = 1;</span>
<span class="tx-line tx-s2">⏳ B  waiting on A's lock (row id=1)</span>
<span class="tx-line tx-s2">⏵ B  ERROR 40P01: deadlock detected</span>
<span class="tx-line tx-s1"><span class="tx-prompt">A&gt;</span> COMMIT;</span>
<span class="tx-line tx-s1">⏵ A  COMMIT — the survivor wins</span></code></pre>
    </div>
  </div>
</template>

<style scoped>
.hero-visual {
  width: 100%;
  max-width: 540px;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid var(--vp-c-divider);
  box-shadow: var(--vp-shadow-3);
}

.hero-visual-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 12px 16px;
  background: var(--vp-c-bg-alt);
  border-bottom: 1px solid var(--vp-c-divider);
}

.hero-visual-bar .dot {
  width: 11px;
  height: 11px;
  border-radius: 50%;
  background: var(--vp-c-gray-1);
}

.hero-visual-title {
  margin-left: 8px;
  font-size: 13px;
  font-family: var(--vp-font-family-mono);
  color: var(--vp-c-text-2);
}

.hero-visual .transcript {
  margin: 0;
  border-radius: 0;
}

.hero-visual .transcript pre {
  padding: 20px 0;
}

.hero-visual .transcript code {
  font-size: 13px;
  line-height: 1.9;
}
</style>
