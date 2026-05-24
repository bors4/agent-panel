<template>
  <div class="card">
    <div v-if="$slots.header" class="card-header">
      <slot name="header" />
    </div>
    <div class="card-body">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  position: relative;
  transition: var(--transition);
  backdrop-filter: blur(10px);
}

.card:hover {
  box-shadow: var(--shadow-lg);
  border-color: var(--border-hover);
}

.card::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: var(--gradient-accent);
  opacity: 0.3;
}

.card-header {
  padding: 14px 18px;
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: relative;
  z-index: 2;
}

.card-header h2 {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  background: var(--gradient-accent);
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.card-body {
  padding: 16px 18px;
  position: relative;
  z-index: 1;
  overflow: hidden;
}

/* Card с контентом */
.card-content {
  background: var(--gradient-bg);
  border-radius: var(--radius);
  padding: 16px;
  margin: -16px;
  margin-top: -1px;
  position: relative;
  z-index: 0;
}

/* Card с тенью для контраста */
.card-elevated {
  box-shadow: var(--shadow-lg);
  border: 1px solid var(--glass-border);
}

/* Card с градиентной рамкой */
.card-gradient {
  position: relative;
  border: none;
}

.card-gradient::before {
  content: "";
  position: absolute;
  inset: -2px;
  background: var(--gradient-accent);
  border-radius: var(--radius);
  opacity: 0.3;
  z-index: -1;
  transition: opacity 0.3s ease;
}

.card-gradient:hover::before {
  opacity: 0.6;
}
</style>
