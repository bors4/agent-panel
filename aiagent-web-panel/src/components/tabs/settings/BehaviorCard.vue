<!--
  Секция CFG://BEHAVIOR: тумблеры поведения (stream, insertUserAfterTool, chatMode, autoSave, verbose, autoStart).
  Двусторонний биндинг через v-model на config.
-->
<template>
  <Card>
    <template #header>
      <div class="header-row">
        <h3 class="mono-label">CFG://BEHAVIOR</h3>
      </div>
    </template>

    <div class="form-group">
      <div class="form-label">
        <label>Потоковый вывод (SSE)</label>
        <span class="hint">Token-by-token вывод ответа</span>
      </div>
      <div class="toggle-control">
        <label class="toggle-switch">
          <input v-model="config.stream" type="checkbox" />
          <span class="toggle-slider" />
        </label>
      </div>
    </div>

    <div class="form-group">
      <div class="form-label">
        <label>insertUserAfterTool</label>
        <span class="hint">В Jinja-шаблонах user после tool</span>
      </div>
      <div class="toggle-control">
        <label class="toggle-switch">
          <input v-model="config.insertUserAfterTool" type="checkbox" />
          <span class="toggle-slider" />
        </label>
      </div>
    </div>

    <div class="form-group">
      <div class="form-label">
        <label>CHAT MODE</label>
        <span class="hint">Отключить проектный контекст</span>
      </div>
      <div class="toggle-control">
        <label class="toggle-switch">
          <input v-model="config.chatMode" type="checkbox" />
          <span class="toggle-slider" />
        </label>
      </div>
    </div>

    <div class="form-group">
      <div class="form-label">
        <label>AUTO SAVE</label>
        <span class="hint">Автосохранение изменений</span>
      </div>
      <div class="toggle-control">
        <label class="toggle-switch">
          <input v-model="config.autoSave" type="checkbox" />
          <span class="toggle-slider" />
        </label>
      </div>
    </div>

    <div class="form-group">
      <div class="form-label">
        <label>VERBOSE</label>
        <span class="hint">Детализация логов</span>
      </div>
      <div class="toggle-control">
        <label class="toggle-switch">
          <input v-model="config.verbose" type="checkbox" />
          <span class="toggle-slider" />
        </label>
      </div>
    </div>

    <div class="form-group">
      <div class="form-label">
        <label>AUTO START</label>
        <span class="hint">Автозапуск бота при загрузке</span>
      </div>
      <div class="toggle-control">
        <label class="toggle-switch">
          <input v-model="config.autoStart" type="checkbox" />
          <span class="toggle-slider" />
        </label>
      </div>
    </div>
  </Card>
</template>

<script setup>
import Card from "../../ui/Card.vue";

defineProps({
  config: { type: Object, required: true },
});
</script>

<style scoped>
.mono-label {
  font-family: "JetBrains Mono", monospace;
  font-size: 0.65rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--text-muted);
}

.header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.form-group {
  margin-bottom: 10px;
}

.form-group:last-child {
  margin-bottom: 0;
}

.form-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}

.form-label label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.form-label .hint {
  font-size: 11px;
  color: var(--text-muted);
}

.toggle-control {
  display: flex;
  justify-content: flex-end;
  padding: 4px 0;
}

.toggle-switch {
  position: relative;
  display: inline-block;
  width: 40px;
  height: 22px;
  cursor: pointer;
}

.toggle-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-slider {
  position: absolute;
  inset: 0;
  background: var(--bg-tertiary);
  border-radius: 22px;
  border: 1px solid var(--border);
  transition: var(--transition);
}

.toggle-slider::before {
  content: "";
  position: absolute;
  left: 3px;
  bottom: 3px;
  width: 14px;
  height: 14px;
  background: var(--text-muted);
  border-radius: 50%;
  transition: var(--transition);
}

.toggle-switch input:checked + .toggle-slider {
  background: var(--accent);
  border-color: var(--accent);
}

.toggle-switch input:checked + .toggle-slider::before {
  transform: translateX(18px);
  background: white;
}
</style>
