import type { Course } from "../types/course";

const COURSES_KEY = "ai-cademy-courses";
const ENABLED_AGENTS_KEY = "ai-cademy-enabled-agents";
const ENABLED_AGENTS_SET_KEY = "ai-cademy-enabled-agents-set";

export type AgentCatalogItem = {
  key: string;
  name: string;
  description: string;
};

export const agentCatalog: AgentCatalogItem[] = [
  {
    key: "topic",
    name: "Topic Extraction Agent",
    description: "Extracts key topics from academic content.",
  },
  {
    key: "syllabus",
    name: "Syllabus Builder",
    description: "Builds structured course syllabi automatically.",
  },
  {
    key: "homework",
    name: "Homework Generator",
    description: "Generates personalized homework assignments.",
  },
  {
    key: "evaluation",
    name: "Homework Checking Agent",
    description: "Checks homework against your rubric and suggests a grade.",
  },
  {
    key: "booklet",
    name: "Course Booklet Generator",
    description: "Creates a full course booklet.",
  },
  {
    key: "code_review",
    name: "Pedagogical Code Review Agent",
    description:
      "Creates a sample solution and explains a pedagogical code review (demo only).",
  },
];

type EnabledAgentsByCourse = Record<string, Record<string, boolean>>;
type EnabledAgentsSetByCourse = Record<string, boolean>;

function readJson<T>(key: string, fallback: T): T {
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

export function listCourses(ownerUserId?: string): Course[] {
  const courses = readJson<Course[]>(COURSES_KEY, []);
  if (!ownerUserId) return courses;
  return courses.filter((course) => course.owner_user_id === ownerUserId);
}

export function createCourse(input: {
  name: string;
  owner_user_id: string;
  code?: string;
  term?: string;
}): Course {
  const courses = readJson<Course[]>(COURSES_KEY, []);
  const course: Course = {
    id: crypto.randomUUID(),
    name: input.name.trim(),
    owner_user_id: input.owner_user_id,
    code: input.code?.trim() || undefined,
    term: input.term?.trim() || undefined,
    created_at: new Date().toISOString(),
  };
  courses.unshift(course);
  writeJson(COURSES_KEY, courses);

  return course;
}

export function getCourse(courseId: string): Course | null {
  const courses = readJson<Course[]>(COURSES_KEY, []);
  return courses.find((course) => course.id === courseId) ?? null;
}

export function listEnabledAgents(courseId: string): Record<string, boolean> {
  const enabledAgents = readJson<EnabledAgentsByCourse>(ENABLED_AGENTS_KEY, {});
  const enabledAgentsSet = readJson<EnabledAgentsSetByCourse>(
    ENABLED_AGENTS_SET_KEY,
    {},
  );
  if (!enabledAgentsSet[courseId]) {
    return {};
  }
  const stored = enabledAgents[courseId] ?? {};
  return Object.fromEntries(
    agentCatalog.map((agent) => [
      agent.key,
      stored[agent.key] ?? true,
    ]),
  );
}

export function setEnabledAgents(
  courseId: string,
  next: Record<string, boolean>,
): void {
  const enabledAgents = readJson<EnabledAgentsByCourse>(ENABLED_AGENTS_KEY, {});
  enabledAgents[courseId] = next;
  writeJson(ENABLED_AGENTS_KEY, enabledAgents);
  const enabledAgentsSet = readJson<EnabledAgentsSetByCourse>(
    ENABLED_AGENTS_SET_KEY,
    {},
  );
  enabledAgentsSet[courseId] = true;
  writeJson(ENABLED_AGENTS_SET_KEY, enabledAgentsSet);
}
