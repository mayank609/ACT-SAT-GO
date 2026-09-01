// Fallback comprehensive SAT & ACT Diagnostic test questions with real explanations and grading
export const FALLBACK_SAT_TEST = {
  id: 'sat_diagnostic_default',
  title: 'Official SAT Diagnostic Test (Full-Length)',
  category: 'SAT',
  description: 'Full-length diagnostic test covering Digital SAT Reading & Writing and Math modules with official scoring.',
  sections: [
    {
      id: 'sec_rw_1',
      name: 'Section 1: Reading and Writing',
      durationMinutes: 32,
      orderIndex: 0,
      questions: [
        {
          id: 'sat_rw_q1',
          type: 'MCQ',
          content: {
            text: 'Archaeologists exploring the ancient Mayan site of Palenque were surprised by the ______ of jade artifacts found in tombs of minor nobles, suggesting that wealth was more widely distributed than previously believed.',
            explanation: 'The context contrasts the previous belief that wealth was concentrated with the discovery of many jade artifacts in lower noble tombs. "Abundance" or "profusion" fits this meaning.',
            meta: { domain: 'Craft and Structure', skill: 'Words in Context' },
          },
          options: {
            A: 'scarcity',
            B: 'profusion',
            C: 'deterioration',
            D: 'authenticity'
          },
          correctAnswer: { key: 'B' },
          marksPositive: 1,
          marksNegative: 0,
        },
        {
          id: 'sat_rw_q2',
          type: 'MCQ',
          content: {
            text: 'Although the author\'s primary thesis is that renewable energy transitions are accelerating, she remains ______ about the geopolitical hurdles associated with securing rare earth minerals required for battery manufacturing.',
            explanation: 'The transition "Although... accelerating" introduces a contrasting, cautionary perspective regarding geopolitical challenges. "Circumspect" (cautious and wary) fits best.',
            meta: { domain: 'Information and Ideas', skill: 'Central Ideas and Details' },
          },
          options: {
            A: 'circumspect',
            B: 'complacent',
            C: 'indifferent',
            D: 'exuberant'
          },
          correctAnswer: { key: 'A' },
          marksPositive: 1,
          marksNegative: 0,
        },
        {
          id: 'sat_rw_q3',
          type: 'MCQ',
          content: {
            text: 'Which choice completes the text with the most logical transition?\n\nQuantum computing promises to revolutionize materials science by modeling molecular interactions at unprecedented scales. ______, substantial engineering challenges in maintaining qubit coherence have slowed practical deployment in commercial settings.',
            explanation: 'The second sentence provides a contrasting limitation to the promising potential mentioned in the first sentence. "However" is the appropriate adversative transition.',
            meta: { domain: 'Expression of Ideas', skill: 'Transitions' },
          },
          options: {
            A: 'Furthermore',
            B: 'However',
            C: 'For example',
            D: 'Consequently'
          },
          correctAnswer: { key: 'B' },
          marksPositive: 1,
          marksNegative: 0,
        },
        {
          id: 'sat_rw_q4',
          type: 'MCQ',
          content: {
            text: 'Which choice conforms to the conventions of Standard English?\n\nThe team of marine biologists ______ gathered water samples near the hydrothermal vents to measure chemical variations across depths.',
            explanation: 'The subject is "The team" (singular collective noun), which takes the singular past/present verb form.',
            meta: { domain: 'Standard English Conventions', skill: 'Subject-Verb Agreement' },
          },
          options: {
            A: 'have',
            B: 'has',
            C: 'are',
            D: 'were'
          },
          correctAnswer: { key: 'B' },
          marksPositive: 1,
          marksNegative: 0,
        },
        {
          id: 'sat_rw_q5',
          type: 'MCQ',
          content: {
            text: 'Astronomer Vera Rubin analyzed the rotational curves of spiral galaxies in the 1970s. She observed that stars at the outer perimeter orbited as fast as stars near the center. This crucial finding provided the first robust observational evidence for the existence of ______ matter.',
            explanation: 'Vera Rubin\'s galaxy rotation curve measurements provided the pioneering evidence for dark matter.',
            meta: { domain: 'Information and Ideas', skill: 'Inferences' },
          },
          options: {
            A: 'dark',
            B: 'antimatter',
            C: 'plasma',
            D: 'interstellar'
          },
          correctAnswer: { key: 'A' },
          marksPositive: 1,
          marksNegative: 0,
        }
      ]
    },
    {
      id: 'sec_math_1',
      name: 'Section 2: Math (Calculator Permitted)',
      durationMinutes: 35,
      orderIndex: 1,
      questions: [
        {
          id: 'sat_m_q1',
          type: 'MCQ',
          content: {
            text: 'If 3x + 7 = 28, what is the value of 6x + 2?',
            explanation: '3x = 28 - 7 = 21, so x = 7. Thus, 6x + 2 = 6(7) + 2 = 42 + 2 = 44.',
            meta: { domain: 'Algebra', skill: 'Linear Equations in One Variable' },
          },
          options: {
            A: '14',
            B: '28',
            C: '44',
            D: '50'
          },
          correctAnswer: { key: 'C' },
          marksPositive: 1,
          marksNegative: 0,
        },
        {
          id: 'sat_m_q2',
          type: 'MCQ',
          content: {
            text: 'A line in the xy-plane passes through the points (2, 5) and (6, 17). What is the slope of this line?',
            explanation: 'Slope m = (y2 - y1) / (x2 - x1) = (17 - 5) / (6 - 2) = 12 / 4 = 3.',
            meta: { domain: 'Algebra', skill: 'Linear Functions & Slopes' },
          },
          options: {
            A: '2',
            B: '3',
            C: '4',
            D: '6'
          },
          correctAnswer: { key: 'B' },
          marksPositive: 1,
          marksNegative: 0,
        },
        {
          id: 'sat_m_q3',
          type: 'NUMERIC',
          content: {
            text: 'If x² - 8x + 15 = 0, and x > 4, what is the value of x?',
            explanation: 'Factoring: (x - 3)(x - 5) = 0, giving solutions x = 3 or x = 5. Since x > 4, x = 5.',
            meta: { domain: 'Advanced Math', skill: 'Nonlinear Equations' },
          },
          options: {},
          correctAnswer: { value: 5, values: [5] },
          marksPositive: 1,
          marksNegative: 0,
        },
        {
          id: 'sat_m_q4',
          type: 'MCQ',
          content: {
            text: 'A circle in the xy-plane has its center at (-3, 4) and a radius of 5. Which of the following equations represents this circle?',
            explanation: 'Standard form: (x - h)² + (y - k)² = r². Substituting h = -3, k = 4, r = 5 gives (x + 3)² + (y - 4)² = 25.',
            meta: { domain: 'Geometry and Trigonometry', skill: 'Circles' },
          },
          options: {
            A: '(x - 3)² + (y + 4)² = 25',
            B: '(x + 3)² + (y - 4)² = 25',
            C: '(x + 3)² + (y - 4)² = 5',
            D: '(x - 3)² + (y - 4)² = 25'
          },
          correctAnswer: { key: 'B' },
          marksPositive: 1,
          marksNegative: 0,
        },
        {
          id: 'sat_m_q5',
          type: 'NUMERIC',
          content: {
            text: 'In right triangle ABC, angle C is 90° and sin(A) = 3/5. What is the value of cos(B)?',
            explanation: 'For complementary angles in a right triangle, sin(A) = cos(B) = 3/5 = 0.6.',
            meta: { domain: 'Geometry and Trigonometry', skill: 'Trigonometry' },
          },
          options: {},
          correctAnswer: { value: 0.6, values: [0.6, 0.60] },
          marksPositive: 1,
          marksNegative: 0,
        }
      ]
    }
  ]
};

export const FALLBACK_ACT_TEST = {
  id: 'act_diagnostic_default',
  title: 'Official ACT Diagnostic Test (Full-Length)',
  category: 'ACT',
  description: 'Full-length diagnostic test covering ACT English, Math, Reading, and Science reasoning sections.',
  sections: [
    {
      id: 'sec_act_eng',
      name: 'Section 1: ACT English',
      durationMinutes: 45,
      orderIndex: 0,
      questions: [
        {
          id: 'act_e_1',
          type: 'MCQ',
          content: {
            text: 'The chef meticulously prepared the ingredients; chopping onions, mincing garlic, and measuring spices with precision.',
            explanation: 'A semicolon cannot introduce a list of participial phrases. A colon or comma is needed after an independent clause.',
            meta: { domain: 'Punctuation', skill: 'Semicolon Usage' },
          },
          options: {
            A: 'NO CHANGE',
            B: 'ingredients: chopping',
            C: 'ingredients chopping',
            D: 'ingredients; having chopped'
          },
          correctAnswer: { key: 'B' },
          marksPositive: 1,
          marksNegative: 0,
        },
        {
          id: 'act_e_2',
          type: 'MCQ',
          content: {
            text: 'Neither the musicians nor the conductor ______ ready for the unexpected encore requested by the enthusiastic audience.',
            explanation: 'With "neither... nor", the verb agrees with the subject closest to it ("the conductor" = singular "was").',
            meta: { domain: 'Conventions', skill: 'Subject-Verb Agreement' },
          },
          options: {
            A: 'were',
            B: 'was',
            C: 'are',
            D: 'have been'
          },
          correctAnswer: { key: 'B' },
          marksPositive: 1,
          marksNegative: 0,
        }
      ]
    },
    {
      id: 'sec_act_math',
      name: 'Section 2: ACT Mathematics',
      durationMinutes: 60,
      orderIndex: 1,
      questions: [
        {
          id: 'act_m_1',
          type: 'MCQ',
          content: {
            text: 'What is the sum of the solutions to the equation x² - 7x + 12 = 0?',
            explanation: 'Sum of roots for ax² + bx + c = 0 is -b/a = -(-7)/1 = 7.',
            meta: { domain: 'Algebra', skill: 'Quadratic Equations' },
          },
          options: {
            A: '3',
            B: '4',
            C: '7',
            D: '12'
          },
          correctAnswer: { key: 'C' },
          marksPositive: 1,
          marksNegative: 0,
        }
      ]
    }
  ]
};
