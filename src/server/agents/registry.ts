/**
 * Пять агентов FORMIQ TALENT AGENT. Это роли внутри одного приложения,
 * а не пять отдельных сервисов: общий доступ к LLM, общая база, общие
 * правила безопасности. Агент — набор инструментов и инструкций.
 */

export type AgentId = "orchestrator" | "sourcer" | "scout" | "interviewer" | "coordinator";

export type AgentStatus = "active" | "planned";

export interface AgentDefinition {
  id: AgentId;
  name: string;
  role: string;
  /** Что агент делает кодом, без обращения к модели. */
  tools: string[];
  /** Когда агент всё-таки вызывает LLM. */
  llmUsage: string;
  /** Этап плана разработки, на котором агент начинает работать. */
  stage: "H2" | "H4" | "H5" | "H6" | "H7";
  status: AgentStatus;
}

export const AGENTS: Record<AgentId, AgentDefinition> = {
  orchestrator: {
    id: "orchestrator",
    name: "Orchestrator Agent",
    role: "Принимает запрос работодателя, собирает вакансию, распределяет задачи между агентами.",
    tools: ["Разбор запроса по справочникам", "Уточняющие вопросы", "Проверка защищённых признаков", "Маршрутизация задач"],
    llmUsage: "Один вызов на свободное сообщение работодателя. Ответы кнопками обрабатываются без модели.",
    stage: "H2",
    status: "active",
  },
  sourcer: {
    id: "sourcer",
    name: "Sourcer Agent",
    role: "Находит кандидатов только через разрешённые источники: импорт резюме и официальные интеграции.",
    tools: ["Импорт резюме", "Коннекторы разрешённых источников", "Удаление дублей"],
    llmUsage: "Не требуется для импорта. Формулировка поисковых запросов — один вызов на вакансию.",
    stage: "H7",
    status: "planned",
  },
  scout: {
    id: "scout",
    name: "Scout Agent",
    role: "Разбирает резюме и сопоставляет навыки кандидата с требованиями вакансии.",
    tools: ["Извлечение текста резюме", "Структурирование опыта и навыков", "Оценка соответствия с объяснением"],
    llmUsage: "Один вызов на резюме; результат сохраняется и не пересчитывается без изменений вакансии.",
    stage: "H4",
    status: "planned",
  },
  interviewer: {
    id: "interviewer",
    name: "Interviewer Agent",
    role: "Проводит предварительное интервью — только после явного согласия кандидата.",
    tools: ["Сценарий интервью по вакансии", "Фиксация согласия", "Итоговое резюме ответов"],
    llmUsage: "Один вызов на реплику кандидата, с кэшированием постоянной части сценария.",
    stage: "H5",
    status: "planned",
  },
  coordinator: {
    id: "coordinator",
    name: "Coordinator Agent",
    role: "Ведёт этапы найма: статусы, шорт-лист, приглашения на собеседования.",
    tools: ["Воронка найма", "Шаблоны сообщений", "Планирование собеседований"],
    llmUsage: "Черновики сообщений по запросу работодателя. Отправка — только после его подтверждения.",
    stage: "H6",
    status: "planned",
  },
};

export class AgentNotReadyError extends Error {
  constructor(public readonly agent: AgentId) {
    super(`Агент ${AGENTS[agent].name} появится на этапе ${AGENTS[agent].stage}`);
    this.name = "AgentNotReadyError";
  }
}
