// Fallback comprehensive SAT & ACT Diagnostic test questions matching the official 4-module test builder order
export const FALLBACK_SAT_TEST = {
  id: 'sat_diagnostic_default',
  title: 'Official SAT Diagnostic Test (Full-Length)',
  category: 'SAT',
  description: 'Full-length diagnostic test covering Digital SAT Reading & Writing (Modules 1 & 2) and Math (Modules 1 & 2) with official scoring.',
  sections: [
    {
      id: 'sec_rw_1',
      name: 'Reading Writing Module 1',
      durationMinutes: 32,
      orderIndex: 0,
      questions: [
        {
          id: 'sat_rw1_q1',
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
          id: 'sat_rw1_q2',
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
          id: 'sat_rw1_q3',
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
          id: 'sat_rw1_q4',
          type: 'MCQ',
          content: {
            text: 'Which choice conforms to the conventions of Standard English?\n\nThe team of marine biologists ______ gathered water samples near the hydrothermal vents to measure chemical variations across depths.',
            explanation: 'The subject is "The team" (singular collective noun), which takes the singular verb form "has".',
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
          id: 'sat_rw1_q5',
          type: 'MCQ',
          content: {
            text: 'Astronomer Vera Rubin analyzed the rotational curves of spiral galaxies in the 1970s. She observed that stars at the outer perimeter orbited as fast as stars near the center. This crucial finding provided the first robust observational evidence for the existence of ______ matter.',
            explanation: 'Vera Rubin\'s galaxy rotation curve measurements provided the pioneering observational evidence for dark matter.',
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
      id: 'sec_rw_2',
      name: 'Reading Writing Module 2',
      durationMinutes: 32,
      orderIndex: 1,
      questions: [
        {
          id: 'sat_rw2_q1',
          type: 'MCQ',
          content: {
            text: 'While researching a topic, a student has taken the following notes:\n- Epigenetic modifications alter gene activity without changing the underlying DNA sequence.\n- DNA methylation is a common epigenetic mechanism involving the addition of methyl groups to cytosine bases.\n- In honeybees, DNA methylation determines whether larvae develop into worker bees or queen bees.\n\nWhich choice most effectively uses relevant information from the notes to explain how DNA methylation affects bee development?',
            explanation: 'The correct choice directly links DNA methylation as an epigenetic modification determining the caste differentiation (worker vs. queen) in honeybee larvae.',
            meta: { domain: 'Expression of Ideas', skill: 'Rhetorical Synthesis' },
          },
          options: {
            A: 'DNA methylation, an epigenetic change that does not alter DNA sequences, dictates whether honeybee larvae develop into workers or queens.',
            B: 'Epigenetic modifications are changes that alter gene activity in various organisms including bees.',
            C: 'Honeybee larvae possess DNA sequences that contain various methyl groups on cytosine bases.',
            D: 'Worker bees and queen bees share the same DNA sequence despite exhibiting different behaviors.'
          },
          correctAnswer: { key: 'A' },
          marksPositive: 1,
          marksNegative: 0,
        },
        {
          id: 'sat_rw2_q2',
          type: 'MCQ',
          content: {
            text: 'To investigate whether urban noise pollution impairs avian communication, ornithologist Dr. Diaz compared the song frequencies of great tits (Parus major) in rural forests and noisy city centers. She found that urban birds sang at significantly higher minimum frequencies than rural birds.\n\nWhich finding, if true, would most strongly support Dr. Diaz\'s hypothesis that the frequency shifts are an adaptive response to low-frequency traffic noise?',
            explanation: 'Showing that the higher pitch allows songs to be heard above low-frequency traffic rumble directly supports the acoustic adaptation hypothesis.',
            meta: { domain: 'Information and Ideas', skill: 'Command of Evidence (Textual)' },
          },
          options: {
            A: 'Urban birds that sang at higher frequencies had higher mating success in noisy traffic environments than urban birds singing at lower frequencies.',
            B: 'Rural great tits displayed larger body sizes and longer wing spans than their urban counterparts.',
            C: 'Urban noise levels remained constant during nighttime hours when birds were roosting.',
            D: 'Other bird species in the same city did not exhibit changes in their vocalization timings.'
          },
          correctAnswer: { key: 'A' },
          marksPositive: 1,
          marksNegative: 0,
        },
        {
          id: 'sat_rw2_q3',
          type: 'MCQ',
          content: {
            text: 'Which choice completes the text so that it conforms to the conventions of Standard English?\n\nAfter spending years analyzing satellite imagery of the Amazon ______ discovered dozens of previously unknown geoglyphs carved into the landscape centuries ago.',
            explanation: 'The introductory participial modifier "After spending years analyzing satellite imagery of the Amazon" must logically modify the subject that follows the comma: "basin, researchers" or "basin, an international team of archaeologists".',
            meta: { domain: 'Standard English Conventions', skill: 'Boundaries & Modifiers' },
          },
          options: {
            A: 'basin; researchers',
            B: 'basin, researchers',
            C: 'basin. Researchers',
            D: 'basin researchers'
          },
          correctAnswer: { key: 'B' },
          marksPositive: 1,
          marksNegative: 0,
        },
        {
          id: 'sat_rw2_q4',
          type: 'MCQ',
          content: {
            text: 'Many historians initially viewed the Industrial Revolution solely through the lens of technological innovation; ______, recent scholarship has underscored how institutional legal protections and patent laws were equally indispensable catalysts for economic growth.',
            explanation: 'The semicolon is followed by an adverbial transition emphasizing a supplementary or clarifying shift in scholarly perspective ("however" / "nevertheless").',
            meta: { domain: 'Expression of Ideas', skill: 'Transitions' },
          },
          options: {
            A: 'similarly',
            B: 'nevertheless',
            C: 'in conclusion',
            D: 'for instance'
          },
          correctAnswer: { key: 'B' },
          marksPositive: 1,
          marksNegative: 0,
        }
      ]
    },
    {
      id: 'sec_math_1',
      name: 'Math Module 1',
      durationMinutes: 35,
      orderIndex: 2,
      questions: [
        {
          id: 'sat_m1_q1',
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
          id: 'sat_m1_q2',
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
          id: 'sat_m1_q3',
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
          id: 'sat_m1_q4',
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
          id: 'sat_m1_q5',
          type: 'NUMERIC',
          content: {
            text: 'In right triangle ABC, angle C is 90° and sin(A) = 3/5. What is the value of cos(B)?',
            explanation: 'For complementary acute angles in a right triangle, sin(A) = cos(B) = 3/5 = 0.6.',
            meta: { domain: 'Geometry and Trigonometry', skill: 'Trigonometry' },
          },
          options: {},
          correctAnswer: { value: 0.6, values: [0.6, 0.60] },
          marksPositive: 1,
          marksNegative: 0,
        }
      ]
    },
    {
      id: 'sec_math_2',
      name: 'Math Module 2',
      durationMinutes: 35,
      orderIndex: 3,
      questions: [
        {
          id: 'sat_m2_q1',
          type: 'MCQ',
          content: {
            text: 'A system of equations is given below:\n2x + 3y = 13\n4x - y = 5\n\nWhat is the value of x + y?',
            explanation: 'From the second equation, y = 4x - 5. Substitute into the first: 2x + 3(4x - 5) = 13 => 14x - 15 = 13 => 14x = 28 => x = 2. Then y = 4(2) - 5 = 3. Thus, x + y = 2 + 3 = 5.',
            meta: { domain: 'Algebra', skill: 'Systems of Two Linear Equations' },
          },
          options: {
            A: '3',
            B: '4',
            C: '5',
            D: '6'
          },
          correctAnswer: { key: 'C' },
          marksPositive: 1,
          marksNegative: 0,
        },
        {
          id: 'sat_m2_q2',
          type: 'MCQ',
          content: {
            text: 'The population of a bacterial colony is modeled by the function P(t) = 450(1.08)^t, where t is the number of hours since the start of the experiment. Which of the following statements is the best interpretation of the number 1.08 in this context?',
            explanation: '1.08 = 1 + 0.08, which represents an 8% increase in the colony population each hour.',
            meta: { domain: 'Advanced Math', skill: 'Exponential Functions' },
          },
          options: {
            A: 'The initial population of the bacteria is 108.',
            B: 'The population increases by 8% each hour.',
            C: 'The population increases by 108 bacteria every hour.',
            D: 'The colony reaches maximum growth after 1.08 hours.'
          },
          correctAnswer: { key: 'B' },
          marksPositive: 1,
          marksNegative: 0,
        },
        {
          id: 'sat_m2_q3',
          type: 'NUMERIC',
          content: {
            text: 'A sample of 25 students had a mean test score of 82. When 5 additional students took the test with an average score of 94, what became the new mean score for all 30 students?',
            explanation: 'Total score for first 25 = 25 * 82 = 2050. Total for 5 additional = 5 * 94 = 470. Grand total = 2050 + 470 = 2520. New mean = 2520 / 30 = 84.',
            meta: { domain: 'Problem-Solving and Data Analysis', skill: 'One-Variable Data: Distributions and Measures of Center' },
          },
          options: {},
          correctAnswer: { value: 84, values: [84] },
          marksPositive: 1,
          marksNegative: 0,
        },
        {
          id: 'sat_m2_q4',
          type: 'MCQ',
          content: {
            text: 'Which of the following expressions is equivalent to (x² - 9)/(x + 3) for all x ≠ -3?',
            explanation: 'Factor the numerator: (x - 3)(x + 3)/(x + 3) = x - 3.',
            meta: { domain: 'Advanced Math', skill: 'Equivalent Expressions' },
          },
          options: {
            A: 'x - 3',
            B: 'x + 3',
            C: 'x - 9',
            D: 'x² - 3'
          },
          correctAnswer: { key: 'A' },
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
        },
        {
          id: 'act_m_2',
          type: 'MCQ',
          content: {
            text: 'In a right triangle with legs of length 6 and 8, what is the length of the hypotenuse?',
            explanation: 'Using the Pythagorean theorem: c = √(6² + 8²) = √(36 + 64) = √100 = 10.',
            meta: { domain: 'Geometry', skill: 'Pythagorean Theorem' },
          },
          options: {
            A: '10',
            B: '12',
            C: '14',
            D: '100'
          },
          correctAnswer: { key: 'A' },
          marksPositive: 1,
          marksNegative: 0,
        }
      ]
    },
    {
      id: 'sec_act_read',
      name: 'Section 3: ACT Reading',
      durationMinutes: 35,
      orderIndex: 2,
      questions: [
        {
          id: 'act_r_1',
          type: 'MCQ',
          content: {
            text: 'The passage implies that the primary factor contributing to the artist\'s enduring legacy was:',
            explanation: 'The passage emphasizes how the artist broke away from classical conventions to establish a distinctive modern style.',
            meta: { domain: 'Reading Comprehension', skill: 'Inference and Key Ideas' },
          },
          options: {
            A: 'Her innovative departure from conventional artistic traditions',
            B: 'Her extensive formal training at classical academies',
            C: 'Her exclusive reliance on patronage from aristocratic families',
            D: 'Her widespread popularity among contemporary art critics'
          },
          correctAnswer: { key: 'A' },
          marksPositive: 1,
          marksNegative: 0,
        }
      ]
    },
    {
      id: 'sec_act_sci',
      name: 'Section 4: ACT Science',
      durationMinutes: 35,
      orderIndex: 3,
      questions: [
        {
          id: 'act_s_1',
          type: 'MCQ',
          content: {
            text: 'Based on the experiment data, as the temperature of the gas increased from 20°C to 80°C at constant volume, the pressure exerted by the gas:',
            explanation: 'According to Gay-Lussac\'s Law, pressure is directly proportional to temperature at constant volume, so the pressure increased linearly.',
            meta: { domain: 'Data Interpretation', skill: 'Scientific Analysis' },
          },
          options: {
            A: 'Increased steadily',
            B: 'Decreased steadily',
            C: 'Remained constant',
            D: 'Fluctuated unpredictably'
          },
          correctAnswer: { key: 'A' },
          marksPositive: 1,
          marksNegative: 0,
        }
      ]
    }
  ]
};
