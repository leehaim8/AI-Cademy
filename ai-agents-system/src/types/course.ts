export type Course = {
  id: string;
  name: string;
  owner_user_id: string;
  code?: string;
  term?: string;
  created_at?: string;
};

export type CourseMember = {
  course_id: string;
  user_id: string;
  role_in_course?: "lecturer" | "ta" | "student";
};

export type CourseAgent = {
  id: string;
  course_id: string;
  agent_key: string;
  enabled: boolean;
};

export type Session = {
  id: string;
  course_id: string;
  agent_key: string;
  title: string;
  notes?: string;
  created_at: string;
  created_by_user_id?: string;
};

export type SessionRun = {
  id: string;
  session_id: string;
  input_data: unknown;
  output_data: unknown;
  status: "success" | "error" | "running";
  created_at: string;
};
