<template>
  <div class="question-block">
    <div class="question-header">❓ Question</div>
    <div
      v-for="(q, qi) in questions"
      :key="qi"
      class="question-item"
    >
      <div class="question-text">
        <span v-if="q.header" class="question-tag">[{{ q.header }}]</span>
        {{ q.question }}
      </div>
      <div v-if="q.options?.length" class="question-options">
        <label
          v-for="(opt, oi) in q.options"
          :key="oi"
          class="option-label"
          :class="{ selected: isSelected(qi, oi) }"
        >
          <input
            :type="q.multiple ? 'checkbox' : 'radio'"
            :name="'q-' + qi"
            :checked="isSelected(qi, oi)"
            @change="toggleOption(qi, oi)"
          />
          <div class="option-content">
            <span class="option-label-text">{{ opt.label }}</span>
            <span class="option-desc">{{ opt.description }}</span>
          </div>
        </label>
      </div>
      <div v-else class="question-input">
        <input
          v-model="textAnswers[qi]"
          type="text"
          placeholder="Type your answer..."
          class="text-input"
        />
      </div>
    </div>
    <div class="question-buttons">
      <button class="question-btn submit" @click="$emit('submit', { questions, answers: getAnswers() })">
        ✅ Submit
      </button>
      <button class="question-btn reject" @click="$emit('reject', msg)">
        ❌ Cancel
      </button>
    </div>
  </div>
</template>

<script setup>
import { reactive, computed } from "vue";

const props = defineProps({
  msg: { type: Object, required: true },
});

defineEmits(["submit", "reject"]);

const questions = computed(() => {
  try {
    const args = typeof props.msg.toolArgsPretty === "string" ? JSON.parse(props.msg._rawArgs || "{}") : {};
    return args.questions || [];
  } catch {
    return [];
  }
});

const selections = reactive({});
const textAnswers = reactive({});

function isSelected(qi, oi) {
  return selections[qi]?.includes(oi) || false;
}

function toggleOption(qi, oi) {
  if (!selections[qi]) selections[qi] = [];
  const idx = selections[qi].indexOf(oi);
  if (idx >= 0) {
    selections[qi].splice(idx, 1);
  } else if (questions.value[qi]?.multiple) {
    selections[qi].push(oi);
  } else {
    selections[qi] = [oi];
  }
}

function getAnswers() {
  return questions.value.map((q, qi) => {
    if (q.options?.length) {
      return (selections[qi] || []).map((oi) => q.options[oi].label);
    }
    return [textAnswers[qi] || ""];
  });
}
</script>

<style scoped>
.question-block {
  background: var(--info-soft);
  border: 1px solid var(--border);
  border-left: 3px solid var(--info);
  border-radius: var(--radius-sm);
  padding: 10px 12px;
  max-width: 420px;
}

.question-header {
  font-size: 12px;
  font-weight: 600;
  color: var(--info);
  margin-bottom: 8px;
}

.question-item {
  margin-bottom: 10px;
}

.question-text {
  font-size: 11px;
  color: var(--text-1);
  margin-bottom: 6px;
  line-height: 1.4;
}

.question-tag {
  font-weight: 600;
  color: var(--text-1);
  margin-right: 4px;
}

.question-options {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.option-label {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 6px 8px;
  border: 1px solid var(--border);
  border-radius: var(--radius-xs);
  cursor: pointer;
  transition: var(--t-fast);
  background: var(--bg-0);
}

.option-label:hover {
  border-color: var(--info);
}

.option-label.selected {
  border-color: var(--info);
  background: var(--info-soft);
}

.option-label input {
  margin-top: 2px;
}

.option-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.option-label-text {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-1);
}

.option-desc {
  font-size: 10px;
  color: var(--text-2);
}

.question-input {
  margin-top: 4px;
}

.text-input {
  width: 100%;
  padding: 6px 8px;
  font-size: 11px;
  border: 1px solid var(--border);
  border-radius: var(--radius-xs);
  background: var(--bg-0);
  color: var(--text-1);
  outline: none;
  box-sizing: border-box;
}

.text-input:focus {
  border-color: var(--info);
}

.question-buttons {
  display: flex;
  gap: 6px;
  margin-top: 8px;
}

.question-btn {
  padding: 5px 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  cursor: pointer;
  font-size: 11px;
  font-weight: 600;
  transition: var(--t-fast);
  background: var(--bg-2);
}

.question-btn.submit {
  color: var(--success);
  border-color: var(--success-soft);
}

.question-btn.submit:hover {
  background: var(--success);
  color: white;
  border-color: var(--success);
}

.question-btn.reject {
  color: var(--error);
  border-color: var(--error-soft);
}

.question-btn.reject:hover {
  background: var(--error);
  color: white;
  border-color: var(--error);
}
</style>
