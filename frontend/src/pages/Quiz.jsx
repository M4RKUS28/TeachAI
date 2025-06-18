import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Paper,
  Card,
  Text,
  Textarea,
  Button,
  Alert,
  Badge,
  Group,
  Radio,
  Loader,
  Box,
  Stack,
} from '@mantine/core';
import { toast } from 'react-toastify';
import { courseService } from '../api/courseService';
import AiCodeWrapper from "../components/AiCodeWrapper.jsx";

const Quiz = ({ courseId, chapterId, onQuestionCountChange }) => {
  const { t } = useTranslation('chapterView');
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mcAnswers, setMcAnswers] = useState({});
  const [otAnswers, setOtAnswers] = useState({});
  const [gradingQuestion, setGradingQuestion] = useState(null);
  const [questionFeedback, setQuestionFeedback] = useState({});
  const [isPolling, setIsPolling] = useState(false);
  const [courseStatus, setCourseStatus] = useState(null);

  // Track if component is mounted to prevent state updates after unmount
  const isMounted = useRef(true);

  // Cleanup function to cancel any pending operations when component unmounts
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  /**
   * Processes the quiz questions data and updates the component state
   * @param {Array} questionsData - Array of question objects
   */
  const processQuizQuestions = useCallback((questionsData) => {
    if (!questionsData || !Array.isArray(questionsData)) return;

    if (questionsData.length > 0) {
      setQuestions(questionsData);

      // Notify parent of question count
      if (onQuestionCountChange) {
        onQuestionCountChange(questionsData.length);
      }

      // Initialize answers with existing user answers if available
      const initialMCAnswers = {};
      const initialOTAnswers = {};
      const initialFeedback = {};

      questionsData.forEach((question) => {
        if (question.type === 'MC') {
          initialMCAnswers[question.id] = question.users_answer || '';
          // If user has already answered and there's an explanation, show feedback immediately
          if (question.users_answer) {
            const isCorrect = question.users_answer === question.correct_answer;
            initialFeedback[question.id] = {
              feedback: question.explanation || (isCorrect ? 'Correct!' : 'Incorrect. Please review the material.'),
              points_received: isCorrect ? 1 : 0,
              correct_answer: question.correct_answer,
              is_correct: isCorrect
            };
          }
        } else if (question.type === 'OT') {
          initialOTAnswers[question.id] = question.users_answer || '';
          // If there's existing feedback for open text questions, add it to feedback state
          if (question.feedback) {
            initialFeedback[question.id] = {
              feedback: question.feedback,
              points_received: question.points_received,
              correct_answer: question.correct_answer
            };
          }
        }
      });

      setMcAnswers(initialMCAnswers);
      setOtAnswers(initialOTAnswers);
      setQuestionFeedback(initialFeedback);
      return true; // Indicate that questions were processed
    } else {
      // No questions found
      if (onQuestionCountChange) {
        onQuestionCountChange(0);
      }
      return false; // Indicate no questions were found
    }
  }, [onQuestionCountChange]);

  /**
   * Fetches the current course status from the server
   */
  const fetchCourseStatus = useCallback(async () => {
    console.log('Fetching course status for courseId:', courseId);
    try {
      const courseData = await courseService.getCourseById(courseId);
      console.log('Fetched course data:', courseData);
      if (isMounted.current) {
        console.log('Setting course status:', courseData.status);
        setCourseStatus(courseData.status);
        return courseData.status;
      } else {
        console.warn('Component is unmounted, skipping state update for course status');
      }
    } catch (error) {
      console.error('Error fetching course status:', error);
    }
    return null;
  }, [courseId]);

  /**
   * Polls for new quiz questions while the course is being created
   */
  const pollForQuizQuestions = useCallback(async () => {
    if (!isMounted.current) return;

    setIsPolling(true);
    let pollInterval;

    try {
      // Initial check for course status
      const status = await fetchCourseStatus();

      // Only poll if course is in creating status
      if (status === 'CourseStatus.CREATING') {
        pollInterval = setInterval(async () => {
          try {
            // 1. Check course status first
            const currentStatus = await fetchCourseStatus();

            // If course is no longer in creating status, stop polling
            if (currentStatus !== 'CourseStatus.CREATING') {
              clearInterval(pollInterval);
              if (isMounted.current) {
                setIsPolling(false);
                setCourseStatus(currentStatus);
              }
              return;
            }

            // 2. Try to fetch questions
            const questionsData = await courseService.getChapterQuestions(courseId, chapterId);

            // 3. If we got questions, process them and stop polling
            if (questionsData && questionsData.length > 0) {
              const hasProcessedQuestions = processQuizQuestions(questionsData);
              if (hasProcessedQuestions) {
                clearInterval(pollInterval);
                if (isMounted.current) {
                  setIsPolling(false);
                  toast.success(t('quiz.questionsAvailable'));
                }
              }
            }
          } catch (error) {
            console.error('Error during polling:', error);
            // Don't stop polling on error, just log it and continue
          }
        }, 1000); // Poll every second
      } else {
        // Course is not in creating status, no need to poll
        setIsPolling(false);
      }
    } catch (error) {
      console.error('Error starting polling:', error);
      if (isMounted.current) {
        setIsPolling(false);
      }
    }

    // Cleanup function to clear interval if component unmounts
    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [courseId, chapterId, fetchCourseStatus, processQuizQuestions, t]);

  // Fetch quiz questions when component mounts
  useEffect(() => {
    const fetchQuiz = async () => {
      try {
        setLoading(true);
        console.log('Fetching quiz questions for course:', courseId, 'chapter:', chapterId);

        // First, get the current course status
        const status = await fetchCourseStatus();
        console.log('Current course status:', status);

        // Try to fetch questions
        const questionsData = await courseService.getChapterQuestions(courseId, chapterId);
        console.log('Fetched questions:', questionsData);

        // Process questions if we got any
        const hasQuestions = processQuizQuestions(questionsData);
        console.log('Has questions:', hasQuestions);

        // If no questions but course is still being created, start polling
        if (!hasQuestions && status === 'CourseStatus.CREATING') {
          console.log('No questions found, starting polling for quiz questions...');
          await pollForQuizQuestions();
        } else if (hasQuestions) {
          console.log('Questions processed successfully, no need to poll.');
          setIsPolling(false);
        } else {
          console.log('No questions found and course is not being created, stopping polling.');
          setIsPolling(false);
        }


        setError(null);
      } catch (error) {
        console.error('Error in fetchQuiz:', error);
        setError(t('quiz.errors.loadFailed'));
      } finally {
        console.log('Fetch quiz completed');
        // Only set loading to false if component is still mounted
        console.log('isMounted:', isMounted.current);
        if (isMounted.current) {
          setLoading(false);
        }
      }
    };

    fetchQuiz();


    // Cleanup function to cancel any pending operations
    return () => {
      isMounted.current = false;
    };
  }, [courseId, chapterId, fetchCourseStatus, processQuizQuestions, pollForQuizQuestions, t]);

  const handleMCAnswerChange = async (questionId, value) => {
    // Optimistically update UI
    setMcAnswers(prev => ({ ...prev, [questionId]: value }));

    try {
      // Save the answer to the backend
      const updatedQuestion = await courseService.saveMCAnswer(courseId, chapterId, questionId, value);

      // Update the question in state with the server response
      setQuestions(prev => prev.map(q =>
        q.id === questionId ? updatedQuestion : q
      ));

      // Find the question to get the correct answer for immediate feedback
      const question = questions.find(q => q.id === questionId);
      if (!question) return;

      // Show immediate feedback for MC questions
      const isCorrect = value === question.correct_answer;
      const feedback = {
        feedback: question.explanation || (isCorrect ? 'Correct!' : 'Incorrect. Please review the material.'),
        points_received: isCorrect ? 1 : 0,
        correct_answer: question.correct_answer,
        is_correct: isCorrect
      };

      setQuestionFeedback(prev => ({
        ...prev,
        [questionId]: feedback
      }));

      // Show toast notification
      if (isCorrect) {
        toast.success('Correct answer!');
      } else {
        toast.error('Incorrect answer. Check the explanation below.');
      }
    } catch (error) {
      console.error('Error saving MC answer:', error);
      toast.error('Failed to save answer. Please try again.');
      // Revert the optimistic update
      setMcAnswers(prev => ({ ...prev, [questionId]: '' }));
    }
  };

  const handleOTAnswerChange = (questionId, value) => {
    setOtAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  const handleGradeOpenTextQuestion = async (questionId) => {
    const userAnswer = otAnswers[questionId];
    if (!userAnswer?.trim()) {
      toast.error('Please enter an answer before grading');
      return;
    }

    try {
      setGradingQuestion(questionId);
      const feedback = await courseService.getQuestionFeedback(
        courseId,
        chapterId,
        questionId,
        userAnswer
      );

      setQuestionFeedback(prev => ({
        ...prev,
        [questionId]: feedback
      }));

      toast.success('Your answer has been graded!');
    } catch (error) {
      console.error('Error grading question:', error);
      toast.error('Failed to grade your answer. Please try again.');
    } finally {
      setGradingQuestion(null);
    }
  };

  const getQuestionColor = (question, questionId) => {
    const feedback = questionFeedback[questionId];
    let points = null;
    const isOT = question.type === 'OT';
    const maxPoints = isOT ? 2 : 1;

    if (feedback?.points_received !== undefined && feedback.points_received !== null) {
      points = feedback.points_received;
    } else if (question.points_received !== undefined && question.points_received !== null) {
      points = question.points_received;
    } else {
      return 'gray';
    }

    // For MC questions (maxPoints = 1), 1/1 is green, 0/1 is red
    // For OT questions (maxPoints = 2), 0/2 is red, 1/2 is yellow, 2/2 is green
    if (points === 0) return 'red';
    if (points === 1 && maxPoints === 1) return 'green'; // 1/1 for MC
    if (points === 1 && maxPoints === 2) return 'yellow'; // 1/2 for OT
    if (points === 2) return 'green'; // 2/2 for OT
    return 'gray';
  };

  const getQuestionPoints = (question, questionId) => {
    const feedback = questionFeedback[questionId];
    const maxPoints = question.type === 'OT' ? 2 : 1;

    // If we have points from feedback or question object, show them
    if (feedback?.points_received !== undefined && feedback.points_received !== null) {
      return `${feedback.points_received}/${maxPoints}`;
    } else if (question.points_received !== undefined && question.points_received !== null) {
      return `${question.points_received}/${maxPoints}`;
    }

    // If no points yet, just show the max points
    return `${maxPoints} Point${maxPoints > 1 ? 's' : ''}`;
  };

  const getFeedbackTitle = (question, questionId) => {
    const feedback = questionFeedback[questionId];
    let points = null;
    const isOT = question.type === 'OT';
    const maxPoints = isOT ? 2 : 1; // MC questions have max 1 point, OT have max 2

    if (feedback?.points_received !== undefined && feedback.points_received !== null) {
      points = feedback.points_received;
    } else if (question.points_received !== undefined && question.points_received !== null) {
      points = question.points_received;
    } else {
      return null;
    }

    // For MC questions (maxPoints = 1), 1/1 is always Correct
    // For OT questions (maxPoints = 2), 1/2 is Partially Correct, 2/2 is Correct
    if (points === 0) return 'Incorrect';
    if (points === 1 && maxPoints === 2) return 'Partially Correct';
    return 'Correct'; // This covers 1/1 for MC and 2/2 for OT
  };

  // Show loading state
  if (loading) {
    return (
      <Box p="md">
        <Loader />
        <Text>{t('loading')}</Text>
      </Box>
    );
  }

  // Show polling state when waiting for quizzes to be generated
  if (isPolling) {
    return (
      <Stack align="center" justify="center" p="xl">
        <Loader size="xl" variant="dots" />
        <Text align="center" color="dimmed" mt="md">
          {t('quiz.generatingQuestions')}
        </Text>
        <Text size="sm" color="dimmed" align="center">
          {t('quiz.thisMayTakeAMoment')}
        </Text>
      </Stack>
    );
  }

  if (error) {
    return (
      <Paper shadow="xs" p="md" withBorder>
        <Alert color="red" title="Error">
          {error}
        </Alert>
      </Paper>
    );
  }

  if (!questions.length) {
    return (
      <Paper shadow="xs" p="md" withBorder>
        <Text color="dimmed" ta="center" size="lg">
          No quiz questions available for this chapter.
        </Text>
      </Paper>
    );
  }

  return (
    <Paper shadow="xs" p="md" withBorder>
      {/* Questions in original order */}
      {questions.map((question, index) => {
        const isOT = question.type === 'OT';
        const badgeColor = isOT ? 'blue' : 'green';
        const badgeText = isOT ? t('quiz.badge.openText') : t('quiz.badge.multipleChoice');
        
        return (
          <Card key={`${question.type}-${question.id}`} mb="md" withBorder>
            <Group position="apart" align="flex-start" mb="md" noWrap>
              <Box sx={{ flex: 1, overflow: 'hidden' }}>
                <Text weight={500}>
                  {index + 1}.
                </Text>
              </Box>
              <Badge color={badgeColor} size="sm" ml="xs">{badgeText}</Badge>
              <Badge 
                color={getQuestionColor(question, question.id)}
                variant="outline" 
                sx={{ whiteSpace: 'nowrap' }}
              >
                {getQuestionPoints(question, question.id)}
              </Badge>
            </Group>
            <Box mb="md">
              <AiCodeWrapper Background={false}>
                {question.question}
              </AiCodeWrapper>
            </Box>

            {isOT ? (
              /* Open Text Question */
              !questionFeedback[question.id] && !question.feedback ? (
                <Box>
                  <Textarea
                    placeholder={t('quiz.openText.placeholder')}
                    value={otAnswers[question.id] || ''}
                    onChange={(e) => handleOTAnswerChange(question.id, e.target.value)}
                    minRows={3}
                    mb="md"
                  />
                  <Button
                    onClick={() => handleGradeOpenTextQuestion(question.id)}
                    loading={gradingQuestion === question.id}
                    disabled={!otAnswers[question.id]?.trim()}
                    color="blue"
                    size="sm"
                  >
                    {t('quiz.openText.gradeButton')}
                  </Button>
                </Box>
              ) : (
                /* Show feedback if exists */
                <Box>
                  <Textarea
                    value={otAnswers[question.id] || question.users_answer || ''}
                    minRows={3}
                    mb="md"
                    disabled
                    styles={{
                      input: {
                        backgroundColor: '#f8f9fa',
                        color: '#495057',
                        cursor: 'not-allowed',
                      },
                    }}
                  />
                  {(questionFeedback[question.id]?.feedback || question.feedback) && (
                    <Alert
                      color={getQuestionColor(question, question.id)}
                      title={getFeedbackTitle(question, question.id) + ' (AI Feedback)'}
                      mb="sm"
                    >
                      <Text>{questionFeedback[question.id]?.feedback || question.feedback}</Text>
                    </Alert>
                  )}
                </Box>
              )
            ) : (
              /* Multiple Choice Question */
              <>
                <Radio.Group
                  value={mcAnswers[question.id]}
                  onChange={(value) => handleMCAnswerChange(question.id, value)}
                  name={`question-${question.id}`}
                  mb="md"
                >
                  <Radio value="a" label={question.answer_a} mb="xs" />
                  <Radio value="b" label={question.answer_b} mb="xs" />
                  <Radio value="c" label={question.answer_c} mb="xs" />
                  <Radio value="d" label={question.answer_d} mb="xs" />
                </Radio.Group>

                {(questionFeedback[question.id] || (question.users_answer && question.feedback)) && (
                  <Alert
                    color={getQuestionColor(question, question.id)}
                    title={getFeedbackTitle(question, question.id)}
                  >
                    <Text mb="xs">
                      {!(questionFeedback[question.id]?.is_correct ?? (question.users_answer === question.correct_answer)) && (
                        <>{t('quiz.alert.theCorrectAnswerIs')} <strong>
                          {question[`answer_${question.correct_answer}`]}
                        </strong></>
                      )}
                    </Text>
                    {(questionFeedback[question.id]?.feedback || question.explanation) && (
                      <Text>{questionFeedback[question.id]?.feedback || question.explanation}</Text>
                    )}
                  </Alert>
                )}
              </>
            )}
          </Card>
        );
      })}
    </Paper>
  );
};

export default Quiz;