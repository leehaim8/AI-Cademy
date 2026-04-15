import { useEffect, useState } from "react";
import { fetchCourse } from "../lib/api";
import type { Course } from "../types/course";

export function useCourse(courseId: string) {
  const [course, setCourse] = useState<Course | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(courseId));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!courseId) {
      setCourse(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;

    const loadCourse = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const nextCourse = await fetchCourse(courseId);
        if (!cancelled) {
          setCourse(nextCourse);
        }
      } catch (loadError) {
        if (!cancelled) {
          setCourse(null);
          setError(
            loadError instanceof Error ? loadError.message : "Failed to load course.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadCourse();

    return () => {
      cancelled = true;
    };
  }, [courseId]);

  return { course, isLoading, error };
}
