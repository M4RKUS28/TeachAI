import { useState, useEffect } from 'react';
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
} from '@mantine/core';
import { toast } from 'react-toastify';
import { courseService } from '../api/courseService';

const Quiz = ({ courseId, chapterId, onQuestionCountChange }) => {
  const { t } = useTranslation('chapterView');
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mcAnswers, setMcAnswers] = useState({});
  const [otAnswers, setOtAnswers] = useState({});
  const [gradingQuestion, setGradingQuestion] = useState(null);
  const [questionFeedback, setQuestionFeedback] = useState({});

  // Fetch quiz questions when component mounts
  useEffect(() => {
    const fetchQuiz = async () => {
      try {
        setLoading(true);
        // Use the existing getChapterQuestions method that returns full QuestionResponse data
        const questionsData = await courseService.getChapterQuestions(courseId, chapterId);

        if (questionsData && questionsData.length > 0) {
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
        } else {
          // No questions found
          if (onQuestionCountChange) {
            onQuestionCountChange(0);
          }
        }

        setError(null);
      } catch (error) {
        setError('Failed to load quiz questions');
        console.error('Error fetching quiz questions:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchQuiz();
  }, [courseId, chapterId]);

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

    if (feedback?.points_received !== undefined && feedback.points_received !== null) {
      points = feedback.points_received;
    } else if (question.points_received !== undefined && question.points_received !== null) {
      points = question.points_received;
    } else {
      return 'gray';
    }

    if (points === 0) return 'red';
    if (points === 1) return 'yellow';
    if (points === 2) return 'green';
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

    if (feedback?.points_received !== undefined && feedback.points_received !== null) {
      points = feedback.points_received;
    } else if (question.points_received !== undefined && question.points_received !== null) {
      points = question.points_received;
    } else {
      return null;
    }

    if (points === 0) return 'Incorrect';
    if (points === 1) return 'Partially Correct';
    if (points === 2) return 'Correct';
    return null;
  };

  if (loading) {
    return (
      <Paper shadow="xs" p="md" withBorder>
        <Group position="center">
          <Loader size="lg" />
          <Text>Loading quiz...</Text>
        </Group>
      </Paper>
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
                  {index + 1}. {question.question}
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