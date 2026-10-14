// Long-form articles served at /resources/<slug>. These are prerendered to
// static HTML (scripts/prerender.mjs), listed in the sitemap and llms.txt, and
// emitted as Article + FAQPage structured data (schema.ts), so search engines
// and AI answer engines can read and quote them.
//
// Writing rules: open with a direct answer, keep facts checkable against
// College Board / ACT, and only quote ACT SAT GO prices that match
// data/programs.ts.

import type { FaqItem } from './faq';
import { SAT_PAGE, ACT_PAGE } from './programs';

/** Fee table rows built from the program pages, so prices never drift. */
const money = (p: string) => p.replace(/^\$(\d)(\d{3})$/, '$$$1,$2');
const feeRows = () =>
  [...SAT_PAGE.tiers, ...ACT_PAGE.tiers].map((t) => [t.name, t.weeks.replace(/\s*–\s*/, ' to ').replace('Weeks', 'weeks'), money(t.price)]);

export interface ArticleTable {
  head: string[];
  rows: string[][];
}

export interface ArticleSection {
  heading: string;
  paragraphs?: string[];
  list?: string[];
  table?: ArticleTable;
}

export interface Article {
  slug: string;
  /** Visible H1. */
  title: string;
  /** <title> tag. */
  metaTitle: string;
  description: string;
  /** ISO date (YYYY-MM-DD) shown as "Last updated" and used in schema. */
  published: string;
  updated: string;
  tag: string;
  /** The direct answer, shown first on the page. */
  answer: string;
  sections: ArticleSection[];
  faq: FaqItem[];
  /** Primary sources cited at the end of the article. */
  sources?: { name: string; url: string }[];
}

export const ARTICLES: Article[] = [
  {
    slug: 'sat-vs-act',
    title: 'SAT vs ACT in 2026: Which Test Should You Take?',
    metaTitle: 'SAT vs ACT in 2026: Which Test Should You Take? | ACT SAT GO',
    description:
      'The Digital SAT and the enhanced ACT compared side by side: length, sections, timing, scoring and calculator rules, plus a simple way to decide which test suits your child.',
    published: '2026-10-11',
    updated: '2026-10-11',
    tag: 'SAT & ACT',
    answer:
      'US colleges accept the SAT and the ACT equally, so the right test is the one your child scores higher on. The Digital SAT is adaptive and gives more time per question; the enhanced ACT is a fixed test with more questions in less time and an optional Science section. The fastest way to decide is to take one full practice test of each and compare the results.',
    sections: [
      {
        heading: 'The two tests side by side',
        table: {
          head: ['', 'Digital SAT', 'Enhanced ACT'],
          rows: [
            ['Total length', 'About 2 hours 14 minutes', 'About 2 hours 5 minutes (plus 40 minutes with Science)'],
            ['Sections', 'Reading and Writing; Math', 'English; Math; Reading; Science (optional)'],
            ['Questions', '98 (54 Reading and Writing, 44 Math)', '131 core (50 English, 45 Math, 36 Reading), plus 40 Science'],
            ['Format', 'Adaptive: the second module of each section depends on how you did on the first', 'Fixed: every student sees the same questions'],
            ['Score range', '400 to 1600', '1 to 36 composite (average of English, Math and Reading)'],
            ['Calculator', 'Allowed on all of Math, with Desmos built in', 'Allowed on all of Math'],
          ],
        },
      },
      {
        heading: 'Time per question',
        paragraphs: [
          'Pacing is the biggest practical difference. The Digital SAT gives about 71 seconds per Reading and Writing question and about 95 seconds per Math question. The enhanced ACT gives about 42 seconds per English question and about 67 seconds per Math or Reading question.',
          'Students who work carefully but slowly often prefer the SAT. Students who read quickly and stay accurate under time pressure often do well on the ACT.',
        ],
      },
      {
        heading: 'What each test feels like',
        list: [
          'Reading: the SAT uses many short passages, each with one question. The ACT uses four longer passages, each with several questions.',
          'Writing and grammar: both test grammar, punctuation and clear expression. The SAT mixes these into Reading and Writing; the ACT has its own English section.',
          'Math: both cover algebra, advanced math, geometry, trigonometry and data. The ACT tends to include a wider range of topics, while the SAT goes deeper on algebra and data analysis.',
          'Science: the SAT has no science section, though some passages use science topics. The ACT Science section is optional and is scored separately from the composite.',
        ],
      },
      {
        heading: 'How to choose in four steps',
        list: [
          'Check the colleges on your list. Almost all accept either test, but confirm whether any of them require or recommend ACT Science.',
          'Take one full-length, timed practice test of each. Official SAT practice tests are free in College Board’s Bluebook app, and you can take a free SAT or ACT practice test on our site.',
          'Compare the results on equal terms using a concordance table, and note which test felt more comfortable for pacing.',
          'Commit to one test and prepare for it properly. Splitting preparation between both tests usually slows progress on each.',
        ],
      },
    ],
    faq: [
      {
        q: 'Do colleges prefer the SAT or the ACT?',
        a: 'No. US colleges that consider test scores accept the SAT and the ACT equally and do not prefer one over the other. Choose the test your child scores higher on, and check whether any college on your list has a specific rule about ACT Science.',
      },
      {
        q: 'Is the ACT Science section required?',
        a: 'No. On the enhanced ACT, Science is optional and does not count toward the 1 to 36 composite score. Some colleges and STEM programs may still ask for it, so check the requirements of each college on your list before deciding.',
      },
      {
        q: 'Is the Digital SAT easier than the ACT?',
        a: 'Neither test is easier overall. The Digital SAT gives more time per question and uses short passages, while the ACT asks more questions in less time. Many students find one test noticeably more comfortable, which is why taking a practice test of each is the best way to decide.',
      },
      {
        q: 'Can my child take both the SAT and the ACT?',
        a: 'Yes, but it is usually better to pick one after a practice test of each and prepare for it fully. Preparing for both at once splits study time, and most students reach a higher score by focusing on the test that suits them.',
      },
    ],
  },
  {
    slug: 'sat-act-tutoring-cost',
    title: 'How Much Does SAT and ACT Tutoring Cost in 2026?',
    metaTitle: 'How Much Does SAT & ACT Tutoring Cost in 2026? | ACT SAT GO',
    description:
      'What SAT and ACT tutoring costs, what drives the price, how 1-on-1 tutoring compares with classes and self-study, and what ACT SAT GO programs cost.',
    published: '2026-10-11',
    updated: '2026-10-11',
    tag: 'SAT & ACT',
    answer:
      'SAT and ACT tutoring costs vary widely, from free self-study resources to private 1-on-1 tutors charging several hundred dollars an hour. The price depends mostly on the format (self-study, group class or 1-on-1), the tutor’s experience and the number of hours. At ACT SAT GO, live 1-on-1 online programs cost $500 to $1,600 for the SAT and $599 to $1,299 for the ACT, and the first diagnostic lesson is free.',
    sections: [
      {
        heading: 'What drives the price',
        list: [
          'Format: 1-on-1 tutoring costs more than a group class, and a group class costs more than self-study, because the student gets more individual attention.',
          'Tutor experience: tutors with proven score results and years of test-specific experience charge more than general homework tutors.',
          'Number of hours: a full preparation program over several months costs more than a short refresher before the test.',
          'What is included: practice tests, score reports, homework review and parent updates add value that an hourly rate alone does not show.',
        ],
      },
      {
        heading: 'Comparing the main options',
        table: {
          head: ['Option', 'Typical cost', 'Best for'],
          rows: [
            ['Self-study (Bluebook, Khan Academy, official guides)', 'Free to low cost', 'Motivated students who need structure less than practice'],
            ['Group classes', 'Moderate, usually a fixed course fee', 'Students who learn well at a set pace with others'],
            ['1-on-1 tutoring', 'Highest, by the hour or by program', 'Students with a specific target score, a close test date, or gaps in particular topics'],
          ],
        },
      },
      {
        heading: 'ACT SAT GO program fees',
        paragraphs: [
          'All ACT SAT GO programs are live, 1-on-1 and online. Fees are listed in full on our SAT and ACT pages.',
        ],
        table: {
          head: ['Program', 'Length', 'Fee'],
          rows: feeRows(),
        },
      },
      {
        heading: 'Questions to ask before you pay any tutor',
        list: [
          'Will my child take a diagnostic test first, and will I see the results?',
          'Is the tutor a specialist in this exact test (Digital SAT or enhanced ACT)?',
          'How many full-length practice tests are included, and do they come with score reports?',
          'How will I see progress between sessions?',
          'What is the rescheduling, cancellation and refund policy?',
        ],
      },
    ],
    faq: [
      {
        q: 'Is SAT or ACT tutoring worth the cost?',
        a: 'Tutoring is most worth it when your child has a specific target score, a test date coming up, or clear gaps that self-study has not fixed. A diagnostic test shows how far your child is from their target, which tells you how much help is actually needed before you spend anything.',
      },
      {
        q: 'How many hours of SAT or ACT tutoring does a student need?',
        a: 'It depends on the gap between the current score and the target. A small improvement may need a few weeks of focused sessions, while a large one usually needs a full program of three to four months with regular practice tests. A diagnostic is the best way to estimate it.',
      },
      {
        q: 'Are there free ways to prepare for the SAT and ACT?',
        a: 'Yes. College Board offers free full-length Digital SAT practice tests in its Bluebook app and free practice through Khan Academy, and ACT publishes free practice material. You can also take a free timed SAT or ACT practice test with a score report on the ACT SAT GO website.',
      },
    ],
  },
  {
    slug: 'how-long-to-study-for-digital-sat',
    title: 'How Long Should You Study for the Digital SAT?',
    metaTitle: 'How Long Should You Study for the Digital SAT? | ACT SAT GO',
    description:
      'How many weeks and hours to study for the Digital SAT, based on how many points you need to gain, plus a step-by-step plan and the free official resources to use.',
    published: '2026-10-11',
    updated: '2026-10-11',
    tag: 'SAT',
    answer:
      'Most students preparing for the Digital SAT from the start need about 12 to 16 weeks of steady study, at roughly 4 to 6 hours a week. A student who only needs a small improvement may be ready in 4 to 6 weeks. The right amount depends on the gap between your current score, measured with a full practice test, and your target score.',
    sections: [
      {
        heading: 'Study time by points you need to gain',
        paragraphs: [
          'This is the rule of thumb our tutors use when planning a student’s preparation. Measure the starting point with a full-length, timed practice test.',
        ],
        table: {
          head: ['Points to gain', 'Suggested prep time', 'Weekly study'],
          rows: [
            ['Up to 50 points', '4 to 6 weeks', '3 to 5 hours'],
            ['50 to 150 points', '8 to 12 weeks', '4 to 6 hours'],
            ['More than 150 points', '12 to 16 weeks or longer', '5 to 8 hours'],
          ],
        },
      },
      {
        heading: 'A simple plan that works',
        list: [
          'Take a full-length, timed practice test to get your baseline score.',
          'Pick a test date that leaves enough weeks for your gap, and ideally time for a second attempt.',
          'Spend most of your time on the question types you miss most often, not on what you already know.',
          'Take a full-length practice test every two to three weeks to check progress and build stamina.',
          'Review every mistake: note why you got it wrong and redo similar questions.',
          'In the last week, review rather than learn new material, and rest well before test day.',
        ],
      },
      {
        heading: 'Free official resources',
        list: [
          'Bluebook: College Board’s testing app, which includes full-length adaptive Digital SAT practice tests.',
          'Khan Academy: free official SAT practice, organised by skill.',
          'ACT SAT GO free practice test: a timed SAT or ACT test with a section and topic score report.',
        ],
      },
      {
        heading: 'Signs you need more time',
        list: [
          'Your practice scores have stayed flat across two or three full tests.',
          'You regularly run out of time in either section.',
          'The same topics keep appearing in your mistakes.',
        ],
        paragraphs: [
          'If any of these apply, push the test date back or get targeted help on the weak areas rather than simply taking more practice tests.',
        ],
      },
    ],
    faq: [
      {
        q: 'Can I prepare for the Digital SAT in one month?',
        a: 'Yes, if you only need a modest improvement and can study consistently. A focused 4 to 6 week plan works best when it targets the question types you miss most and includes at least two full-length practice tests to build pacing and stamina.',
      },
      {
        q: 'How many hours a week should I study for the SAT?',
        a: 'Most students make good progress with about 4 to 6 hours a week, including one full practice test every two to three weeks. Students aiming for a large score increase, or with less time before the test, may need 6 to 8 hours a week.',
      },
      {
        q: 'When should I start studying for the SAT?',
        a: 'Start about three to four months before your planned test date, which for many students is the summer before or the autumn of junior year. Starting early leaves time for a second attempt if the first score falls short of your target.',
      },
      {
        q: 'How many practice tests should I take before the SAT?',
        a: 'Most students benefit from four to eight full-length, timed practice tests spread across their preparation. Reviewing every mistake after each test matters more than the number of tests you take.',
      },
    ],
  },
  {
    slug: 'what-is-a-good-sat-score',
    title: 'What Is a Good SAT Score in 2026?',
    metaTitle: 'What Is a Good SAT Score in 2026? Averages & College Ranges | ACT SAT GO',
    description:
      'The average SAT score, what counts as a good score for different kinds of colleges, and how to set the right target score for your own college list.',
    published: '2026-10-11',
    updated: '2026-10-11',
    tag: 'SAT',
    answer:
      'A good SAT score is one that falls in or above the middle 50% range of admitted students at the colleges you are applying to. As a national reference, the average SAT score for the class of 2025 was about 1030 out of 1600. A score above 1200 is above average, a score above 1350 is competitive at many selective colleges, and the most selective colleges typically admit students in the high 1400s to 1500s.',
    sections: [
      {
        heading: 'The national average',
        paragraphs: [
          'The SAT is scored from 400 to 1600, with two sections each scored from 200 to 800: Reading and Writing, and Math. According to College Board’s annual report, the class of 2025 averaged about 1029, made up of about 521 in Reading and Writing and 508 in Math.',
          'The average is a useful reference point, but colleges compare your score with the students they admit, not with the national average.',
        ],
      },
      {
        heading: 'Good SAT scores by type of college',
        paragraphs: [
          'These are rough ranges to help you plan. Always check the published middle 50% range for each college on your list, which you can find on its admissions page or Common Data Set.',
        ],
        table: {
          head: ['Type of college', 'Typical middle 50% SAT range', 'A strong target'],
          rows: [
            ['Most selective (Ivy League, Stanford, MIT and similar)', 'About 1480 to 1570', '1530 or higher'],
            ['Highly selective (top 50 national universities)', 'About 1350 to 1530', '1450 or higher'],
            ['Selective state flagships and private colleges', 'About 1200 to 1400', '1350 or higher'],
            ['Most other four-year colleges', 'About 1000 to 1200', '1150 or higher'],
          ],
        },
      },
      {
        heading: 'How to set your target score',
        list: [
          'List the colleges you plan to apply to, including reach, match and likely schools.',
          'Look up the middle 50% SAT range for each one.',
          'Set your target at or above the 75th percentile (the top of the range) for the colleges you care about most.',
          'Take a full-length practice test to measure your starting score, so you know how many points you need to gain.',
        ],
      },
      {
        heading: 'Does a good score still matter if colleges are test-optional?',
        paragraphs: [
          'Yes. A growing number of selective colleges require the SAT or ACT again, and at test-optional colleges a score in or above the middle 50% range can still strengthen an application. If your score falls below a college’s range, test-optional policies let you leave it out.',
        ],
      },
    ],
    faq: [
      {
        q: 'Is 1200 a good SAT score?',
        a: 'Yes. A 1200 is well above the national average of about 1030 and is competitive at many state universities and private colleges. For highly selective colleges, a 1200 usually falls below the middle 50% range, so students aiming for those schools typically target 1400 or higher.',
      },
      {
        q: 'Is 1400 a good SAT score?',
        a: 'Yes. A 1400 is a strong score that places a student well above average and within or above the middle 50% range at many selective colleges. At the most selective colleges, where admitted students often score in the high 1400s to 1500s, a 1400 is usually below the typical range.',
      },
      {
        q: 'What is the average SAT score?',
        a: 'According to College Board’s annual report, the average SAT score for the class of 2025 was about 1029 out of 1600, with about 521 in Reading and Writing and 508 in Math.',
      },
      {
        q: 'What SAT score do I need for an Ivy League school?',
        a: 'Admitted students at Ivy League colleges typically score from the high 1400s to the mid 1500s or higher. A score of 1530 or above puts most applicants within or above the typical range, though scores are only one part of a holistic admissions decision.',
      },
    ],
    sources: [
      { name: 'College Board: SAT Suite Annual Report', url: 'https://reports.collegeboard.org/sat-suite-program-results' },
      { name: 'College Board: Understanding SAT Scores', url: 'https://satsuite.collegeboard.org/scores/understanding-scores' },
    ],
  },
  {
    slug: 'sat-to-act-score-conversion',
    title: 'SAT to ACT Score Conversion Chart (Official Concordance)',
    metaTitle: 'SAT to ACT Score Conversion Chart (Official Concordance) | ACT SAT GO',
    description:
      'Convert SAT scores to ACT scores and back with the official ACT and College Board concordance table, and learn how to use it to choose between the two tests.',
    published: '2026-10-11',
    updated: '2026-10-11',
    tag: 'SAT & ACT',
    answer:
      'To compare SAT and ACT scores, use the official concordance table published by ACT and College Board. For example, an ACT composite of 36 matches an SAT score of 1570 to 1600, an ACT 30 matches an SAT 1360 to 1380, and an ACT 24 matches an SAT 1160 to 1190. Colleges use the same table, so it is the fairest way to see which test gives you the stronger score.',
    sections: [
      {
        heading: 'ACT to SAT concordance table',
        paragraphs: [
          'Each ACT composite score matches a range of SAT total scores. When you need a single number, use the SAT score in the middle column.',
        ],
        table: {
          head: ['ACT composite', 'SAT score (single point)', 'SAT score range'],
          rows: [
            ['36', '1590', '1570–1600'],
            ['35', '1540', '1530–1560'],
            ['34', '1500', '1490–1520'],
            ['33', '1460', '1450–1480'],
            ['32', '1430', '1420–1440'],
            ['31', '1400', '1390–1410'],
            ['30', '1370', '1360–1380'],
            ['29', '1340', '1330–1350'],
            ['28', '1310', '1300–1320'],
            ['27', '1280', '1260–1290'],
            ['26', '1240', '1230–1250'],
            ['25', '1210', '1200–1220'],
            ['24', '1180', '1160–1190'],
            ['23', '1140', '1130–1150'],
            ['22', '1110', '1100–1120'],
            ['21', '1080', '1060–1090'],
            ['20', '1040', '1030–1050'],
            ['19', '1010', '990–1020'],
            ['18', '970', '960–980'],
            ['17', '930', '920–950'],
            ['16', '890', '880–910'],
            ['15', '850', '830–870'],
          ],
        },
      },
      {
        heading: 'How to use the table to choose a test',
        list: [
          'Take one full-length, timed practice test of the Digital SAT and one of the ACT, ideally within the same week.',
          'Convert your ACT composite to its SAT equivalent using the table above.',
          'If one score is clearly higher, prepare for that test. If they are close, choose the test whose format and pacing felt more comfortable.',
        ],
      },
      {
        heading: 'Does the table still apply to the Digital SAT and the enhanced ACT?',
        paragraphs: [
          'Yes. ACT and College Board still publish and use this concordance, and both organizations designed the Digital SAT and the enhanced ACT to keep their score scales comparable with earlier versions. Colleges continue to use this table when comparing applicants who took different tests.',
        ],
      },
    ],
    faq: [
      {
        q: 'What is a 30 ACT score on the SAT?',
        a: 'An ACT composite of 30 corresponds to an SAT score of 1360 to 1380, or 1370 as a single point, according to the official ACT and College Board concordance table.',
      },
      {
        q: 'What is a 1400 SAT score on the ACT?',
        a: 'An SAT score of 1400 corresponds to an ACT composite of 31. Under the official concordance, ACT 31 matches SAT scores from 1390 to 1410.',
      },
      {
        q: 'What is a 1200 SAT score on the ACT?',
        a: 'An SAT score of 1200 corresponds to an ACT composite of 25. Under the official concordance, ACT 25 matches SAT scores from 1200 to 1220.',
      },
      {
        q: 'Do colleges use the concordance table?',
        a: 'Yes. Colleges use the official concordance table published by ACT and College Board to compare applicants who submitted different tests, so neither test gives an advantage when the scores are equivalent.',
      },
    ],
    sources: [
      { name: 'ACT: ACT/SAT Concordance', url: 'https://www.act.org/content/act/en/products-and-services/the-act/scores/act-sat-concordance.html' },
      { name: 'College Board: SAT Concordance Tables', url: 'https://satsuite.collegeboard.org/scores/understanding-scores/concordance' },
    ],
  },
  {
    slug: 'test-optional-colleges',
    title: 'Test-Optional vs Test-Required Colleges in 2026: Should You Submit SAT or ACT Scores?',
    metaTitle: 'Test-Optional vs Test-Required Colleges 2026: Submit SAT/ACT? | ACT SAT GO',
    description:
      'Which colleges require the SAT or ACT again, what test-optional and test-free really mean, and how to decide whether to submit your scores.',
    published: '2026-10-11',
    updated: '2026-10-11',
    tag: 'College Admissions',
    answer:
      'Many highly selective colleges now require the SAT or ACT again, including Harvard, Yale, Stanford, MIT, Brown, Dartmouth, Cornell, Penn and Johns Hopkins, so most students applying to top colleges should plan to take a test. At test-optional colleges, submit your score if it is at or above the college’s middle 50% range, and leave it out if it is well below.',
    sections: [
      {
        heading: 'What the policies mean',
        table: {
          head: ['Policy', 'What it means'],
          rows: [
            ['Test-required', 'You must submit an SAT or ACT score to be considered.'],
            ['Test-optional', 'You choose whether to submit a score. Applications without one are reviewed without penalty.'],
            ['Test-flexible', 'You must submit some test, but you can choose among the SAT, ACT and other exams such as AP or IB.'],
            ['Test-free (test-blind)', 'The college does not look at SAT or ACT scores for admission, even if you send them.'],
          ],
        },
      },
      {
        heading: 'Colleges that require the SAT or ACT',
        paragraphs: [
          'These colleges have announced that they require scores for recent or upcoming admission cycles. Policies change, so confirm each one on the college’s admissions website before you apply.',
        ],
        list: [
          'Harvard, Yale, Brown, Dartmouth, Cornell and the University of Pennsylvania',
          'Stanford, MIT and Caltech',
          'Johns Hopkins University (Krieger and Whiting schools)',
          'Carnegie Mellon University (School of Computer Science; most other schools are test-flexible)',
          'University of Texas at Austin, Ohio State University (Columbus) and the University of Miami',
          'University of Georgia, Georgia Tech and other University System of Georgia campuses',
          'Princeton, Columbia and Notre Dame have announced requirements starting with the 2027–28 application cycle',
        ],
      },
      {
        heading: 'Colleges that do not use scores',
        paragraphs: [
          'The University of California and California State University systems are test-free: they do not consider SAT or ACT scores for admission. Many other colleges remain test-optional.',
        ],
      },
      {
        heading: 'Should you submit your score?',
        list: [
          'Submit it if your score is at or above the middle 50% range for that college.',
          'Consider leaving it out if your score is well below the 25th percentile and the college is test-optional.',
          'Remember that scores can also count toward merit scholarships, course placement and honors programs at some colleges, even when admission is test-optional.',
        ],
      },
    ],
    faq: [
      {
        q: 'Do I need the SAT or ACT for college in 2026?',
        a: 'It depends on your college list. Many highly selective colleges, including Harvard, Yale, Stanford, MIT and Penn, require the SAT or ACT again, while many others remain test-optional and the University of California does not consider scores. Most students applying to selective colleges should plan to take a test.',
      },
      {
        q: 'Is it better to apply test-optional?',
        a: 'Only if your score is well below the college’s typical range. At test-optional colleges, a score at or above the middle 50% range usually helps an application, while leaving out a low score avoids hurting it.',
      },
      {
        q: 'Which Ivy League schools require the SAT or ACT?',
        a: 'Harvard, Yale, Brown, Dartmouth, Cornell and the University of Pennsylvania require the SAT or ACT for current admission cycles, and Princeton and Columbia have announced requirements starting with the 2027–28 application cycle. Check each college’s admissions website for the latest policy.',
      },
    ],
    sources: [
      { name: 'Compass Education Group: Testing Policies in the Spotlight', url: 'https://www.compassprep.com/testing-spotlight/' },
    ],
  },
  {
    slug: 'what-is-a-good-act-score',
    title: 'What Is a Good ACT Score in 2026?',
    metaTitle: 'What Is a Good ACT Score in 2026? Averages & College Ranges | ACT SAT GO',
    description:
      'The average ACT score, what counts as a good composite for different kinds of colleges, and how to set the right target score for your college list.',
    published: '2026-10-11',
    updated: '2026-10-11',
    tag: 'ACT',
    answer:
      'A good ACT score is one that falls in or above the middle 50% range of admitted students at the colleges you are applying to. As a national reference, the average ACT composite for the class of 2025 was 19.4 out of 36. A composite of 24 or higher is above average, 28 or higher is competitive at many selective colleges, and the most selective colleges typically admit students scoring 33 to 35.',
    sections: [
      {
        heading: 'The national average',
        paragraphs: [
          'The ACT composite is scored from 1 to 36. According to ACT, the class of 2025 averaged a composite of 19.4, with section averages of 18.4 in English, 18.9 in Math, 20.0 in Reading and 19.6 in Science.',
          'On the enhanced ACT, the composite is the average of English, Math and Reading only. Science is optional and reported separately.',
        ],
      },
      {
        heading: 'Good ACT scores by type of college',
        paragraphs: [
          'These are rough ranges to help you plan. Always check the published middle 50% range for each college on your list.',
        ],
        table: {
          head: ['Type of college', 'Typical middle 50% ACT range', 'A strong target'],
          rows: [
            ['Most selective (Ivy League, Stanford, MIT and similar)', 'About 33 to 35', '34 or higher'],
            ['Highly selective (top 50 national universities)', 'About 30 to 34', '32 or higher'],
            ['Selective state flagships and private colleges', 'About 25 to 31', '29 or higher'],
            ['Most other four-year colleges', 'About 19 to 25', '24 or higher'],
          ],
        },
      },
      {
        heading: 'How to set your target score',
        list: [
          'List the colleges you plan to apply to, including reach, match and likely schools.',
          'Look up the middle 50% ACT range for each one on its admissions page or Common Data Set.',
          'Set your target at or above the top of the range for the colleges you care about most.',
          'Take a full-length, timed practice test to find your starting score and the gap you need to close.',
        ],
      },
    ],
    faq: [
      {
        q: 'Is 24 a good ACT score?',
        a: 'Yes. A 24 is well above the national average of 19.4 and is competitive at many state universities and private colleges. For highly selective colleges, where admitted students typically score 30 or higher, a 24 usually falls below the typical range.',
      },
      {
        q: 'Is 30 a good ACT score?',
        a: 'Yes. A 30 is a strong composite that places a student well above average and within the typical range at many selective colleges. It is equivalent to an SAT score of about 1370 on the official concordance table.',
      },
      {
        q: 'What is the average ACT score?',
        a: 'According to ACT, the average composite score for the class of 2025 was 19.4 out of 36, with averages of 18.4 in English, 18.9 in Math, 20.0 in Reading and 19.6 in Science.',
      },
      {
        q: 'Does ACT Science count toward the composite score?',
        a: 'Not on the enhanced ACT. The composite is the average of English, Math and Reading. Science is optional, and students who take it receive a separate Science score and a STEM score.',
      },
    ],
    sources: [
      { name: 'ACT: Class of 2025 graduating class data', url: 'https://www.act.org/gradclass2025' },
      { name: 'ACT: 2025 average ACT scores by state and section', url: 'https://www.act.org/content/dam/act/unsecured/documents/2025-Average-ACT-Scores-by-State-Average-Score-by-Section.pdf' },
    ],
  },
  {
    slug: 'sat-test-dates',
    title: 'SAT Test Dates 2026–27: Registration Deadlines and Score Release Dates',
    metaTitle: 'SAT Test Dates 2026–27, Deadlines & Score Release | ACT SAT GO',
    description:
      'Every 2026–27 SAT weekend test date with its registration deadline, late registration deadline and score release date, plus how to choose the right date.',
    published: '2026-10-11',
    updated: '2026-10-11',
    tag: 'SAT',
    answer:
      'The remaining SAT weekend test dates for the 2026–27 school year are November 7 and December 5, 2026, and March 6, May 1 and June 5, 2027. Registration closes about two weeks before each test, and scores are usually released about two weeks after test day. Pick a date that leaves time for a second attempt before your college application deadlines.',
    sections: [
      {
        heading: '2026–27 SAT dates and deadlines',
        paragraphs: [
          'These are College Board’s published dates for SAT weekend testing. Deadlines close at 11:59 p.m. Eastern Time, and late registration costs an extra fee.',
        ],
        table: {
          head: ['Test date', 'Registration deadline', 'Late registration and changes', 'Scores released'],
          rows: [
            ['October 3, 2026', 'September 18, 2026', 'September 22, 2026', 'October 16, 2026'],
            ['November 7, 2026', 'October 23, 2026', 'October 27, 2026', 'November 20, 2026'],
            ['December 5, 2026', 'November 20, 2026', 'November 24, 2026', 'December 18, 2026'],
            ['March 6, 2027', 'February 19, 2027', 'February 23, 2027', 'March 19, 2027'],
            ['May 1, 2027', 'April 16, 2027', 'April 20, 2027', 'May 14, 2027'],
            ['June 5, 2027', 'May 21, 2027', 'May 25, 2027', 'June 21, 2027'],
          ],
        },
      },
      {
        heading: 'How to choose your SAT date',
        list: [
          'Work back from your earliest college deadline. Early Action and Early Decision deadlines are usually November 1 or November 15 of senior year.',
          'Plan for two attempts. Most students improve on a second sitting, so take the first test early enough to leave a later date free.',
          'Leave enough preparation time. Most students need about 12 to 16 weeks to prepare from the start, or 4 to 6 weeks for a smaller improvement.',
          'Avoid weeks packed with school exams, AP tests or major events.',
        ],
      },
      {
        heading: 'A common timeline for juniors',
        table: {
          head: ['When', 'What to do'],
          rows: [
            ['Fall of junior year', 'Take a full practice test and start preparing.'],
            ['March or May of junior year', 'Take the first official SAT.'],
            ['June of junior year, or August to October of senior year', 'Retake if needed, in time for early application deadlines.'],
          ],
        },
      },
    ],
    faq: [
      {
        q: 'When is the next SAT?',
        a: 'The next SAT weekend test dates are November 7 and December 5, 2026, followed by March 6, May 1 and June 5, 2027. Registration closes about two weeks before each date.',
      },
      {
        q: 'How long does it take to get SAT scores?',
        a: 'College Board releases most SAT weekend scores about two weeks after test day, and says scores can take two to four weeks. For example, scores for the December 5, 2026 test are scheduled for release on December 18, 2026.',
      },
      {
        q: 'How many times can you take the SAT?',
        a: 'There is no limit on how many times you can take the SAT. Most students take it two or three times, and many colleges superscore, combining your best section scores across test dates.',
      },
      {
        q: 'Which SAT date is best for seniors applying early?',
        a: 'For November Early Action or Early Decision deadlines, the October test is usually the last date whose scores arrive in time. Check each college’s policy, because some accept November scores for early applications.',
      },
    ],
    sources: [
      { name: 'College Board: SAT Dates and Deadlines', url: 'https://satsuite.collegeboard.org/sat/dates-deadlines' },
      { name: 'College Board: SAT Score Release Dates', url: 'https://satsuite.collegeboard.org/scores/score-release-dates' },
    ],
  },
  {
    slug: 'enhanced-act-changes',
    title: 'The Enhanced ACT Explained: What Changed and What It Means for You',
    metaTitle: 'Enhanced ACT Changes Explained (2026) | ACT SAT GO',
    description:
      'How the enhanced ACT differs from the old ACT: fewer questions, more time per question, optional Science, a new composite and four answer choices in Math.',
    published: '2026-10-11',
    updated: '2026-10-11',
    tag: 'ACT',
    answer:
      'The enhanced ACT is shorter, with fewer questions and more time per question. Science is now optional, the composite score is the average of English, Math and Reading only, and Math questions have four answer choices instead of five. The score scale is still 1 to 36, and scores from before the change remain valid.',
    sections: [
      {
        heading: 'Old ACT vs enhanced ACT',
        table: {
          head: ['', 'Old ACT', 'Enhanced ACT'],
          rows: [
            ['English', '75 questions in 45 minutes', '50 questions in 35 minutes'],
            ['Math', '60 questions in 60 minutes, 5 answer choices', '45 questions in 50 minutes, 4 answer choices'],
            ['Reading', '40 questions in 35 minutes', '36 questions in 40 minutes'],
            ['Science', 'Required: 40 questions in 35 minutes', 'Optional: 40 questions in 40 minutes'],
            ['Composite score', 'Average of English, Math, Reading and Science', 'Average of English, Math and Reading'],
            ['Core test time', 'About 2 hours 55 minutes', 'About 2 hours 5 minutes'],
          ],
        },
      },
      {
        heading: 'What the changes mean for students',
        list: [
          'More time per question: every core section now gives more time per question than before, which helps students who felt rushed on the old ACT.',
          'Science is your choice: skip it unless a college on your list requires or recommends it, or you are applying to STEM programs.',
          'A STEM score: students who take Science also receive a STEM score, combining Math and Science.',
          'Easier guessing odds in Math: with four answer choices instead of five, an educated guess is more likely to be right.',
          'Shorter passages: English and Reading passages are shorter, so reading stamina matters a little less.',
        ],
      },
      {
        heading: 'Is the enhanced ACT easier?',
        paragraphs: [
          'The content is similar, but the test is less rushed and shorter, which many students find more comfortable. Because scores are scaled, a given composite reflects the same level of performance as before, so colleges compare old and new scores directly.',
        ],
      },
    ],
    faq: [
      {
        q: 'When did the enhanced ACT start?',
        a: 'The enhanced ACT launched for national online testing in spring 2025 and for national paper testing in fall 2025. State, district and international testing moved to the enhanced format starting in spring 2026.',
      },
      {
        q: 'Is Science still part of the ACT?',
        a: 'Science is still offered but is now optional. It no longer counts toward the 1 to 36 composite score. Students who take it receive a separate Science score and a STEM score.',
      },
      {
        q: 'Are old ACT scores still valid?',
        a: 'Yes. ACT has said that composite scores earned before the change do not change, and colleges continue to accept them. The score scale is still 1 to 36.',
      },
      {
        q: 'How many questions are on the enhanced ACT?',
        a: 'The enhanced ACT has 131 core questions: 50 English, 45 Math and 36 Reading, in about 2 hours 5 minutes. The optional Science section adds 40 questions and 40 minutes.',
      },
    ],
    sources: [
      { name: 'ACT: The Enhanced ACT Explained', url: 'https://counselorblog.act.org/the-enhanced-act-explained' },
    ],
  },
  {
    slug: 'digital-sat-adaptive-scoring',
    title: 'Is the Digital SAT Adaptive? How Module 2 Works and Affects Your Score',
    metaTitle: 'Is the Digital SAT Adaptive? How Module 2 Works | ACT SAT GO',
    description:
      'How the Digital SAT’s two-stage adaptive design works, why the second module matters for your score, and how to prepare for it.',
    published: '2026-10-11',
    updated: '2026-10-11',
    tag: 'SAT',
    answer:
      'Yes. The Digital SAT is adaptive by section. Each section has two modules, and how well you do on the first module decides whether your second module is easier or harder. Doing well on module 1 unlocks the harder module 2, which is needed for the highest scores, because harder questions contribute more to your score.',
    sections: [
      {
        heading: 'How the test is built',
        table: {
          head: ['Section', 'Module 1', 'Module 2', 'Total'],
          rows: [
            ['Reading and Writing', '27 questions, 32 minutes', '27 questions, 32 minutes', '54 questions, 64 minutes'],
            ['Math', '22 questions, 35 minutes', '22 questions, 35 minutes', '44 questions, 70 minutes'],
          ],
        },
        paragraphs: [
          'Module 1 of each section contains a mix of easy, medium and hard questions. Your results on it decide which version of module 2 you get: one with more difficult questions, or one with fewer.',
        ],
      },
      {
        heading: 'How adaptive scoring affects your score',
        list: [
          'Scoring considers the difficulty of the questions you answer correctly, not just how many you get right.',
          'Students who reach the harder module 2 can earn the highest scores. Students routed to the easier module 2 can still score well, but the top of the scale is harder to reach.',
          'Each module includes a small number of unscored pretest questions, which look like the others. Treat every question as if it counts.',
          'There is no penalty for wrong answers, so never leave a question blank.',
        ],
      },
      {
        heading: 'How to prepare for an adaptive test',
        list: [
          'Make module 1 count: work carefully and check your answers, because it decides your path.',
          'Practice in Bluebook, College Board’s testing app, so the format, timer and built-in Desmos calculator feel familiar.',
          'Use your time well: you can move back and forth within a module, so flag hard questions and return to them.',
          'Train on hard questions too, so you are ready if you reach the harder module 2.',
        ],
      },
    ],
    faq: [
      {
        q: 'Is the Digital SAT adaptive?',
        a: 'Yes. The Digital SAT uses section-level adaptive testing. Each section has two modules, and your performance on the first module decides whether the second module is easier or harder.',
      },
      {
        q: 'Can I go back to questions on the Digital SAT?',
        a: 'Yes, within the same module. You can flag questions and return to them before time runs out, but once a module ends you cannot go back to it.',
      },
      {
        q: 'Does getting the easier second module mean a low score?',
        a: 'Not necessarily. Many students score well after the easier second module, but the highest scores are generally only reachable after the harder one. Strong performance on module 1 keeps every score open.',
      },
    ],
    sources: [
      { name: 'College Board: Understanding SAT Scores', url: 'https://satsuite.collegeboard.org/scores/understanding-scores' },
      { name: 'College Board: Digital SAT overview', url: 'https://satsuite.collegeboard.org/digital' },
    ],
  },
  {
    slug: 'sat-math-strategies',
    title: 'How to Improve Your SAT Math Score: 10 Strategies That Work',
    metaTitle: 'How to Improve Your SAT Math Score: 10 Strategies | ACT SAT GO',
    description:
      'Ten practical strategies to raise your Digital SAT Math score, from mastering the built-in Desmos calculator to targeting the topics that appear most.',
    published: '2026-10-11',
    updated: '2026-10-11',
    tag: 'SAT',
    answer:
      'To raise your SAT Math score, focus on Algebra and Advanced Math, which make up about 70% of the section, learn to use the built-in Desmos graphing calculator, and practice under timed conditions. Review every mistake by topic, because most students lose points on the same few skills again and again.',
    sections: [
      {
        heading: 'What SAT Math covers',
        table: {
          head: ['Content domain', 'Share of questions', 'Examples'],
          rows: [
            ['Algebra', 'About 35%', 'Linear equations, inequalities, systems of equations'],
            ['Advanced Math', 'About 35%', 'Quadratics, exponential and nonlinear functions'],
            ['Problem-Solving and Data Analysis', 'About 15%', 'Ratios, percentages, statistics, probability'],
            ['Geometry and Trigonometry', 'About 15%', 'Area, volume, circles, right triangles, trigonometry'],
          ],
        },
      },
      {
        heading: '10 strategies to raise your score',
        list: [
          'Master linear equations and functions first. They appear throughout Algebra and Advanced Math.',
          'Learn Desmos. The built-in graphing calculator can solve systems, find intercepts and check answers in seconds.',
          'Use the reference sheet. Formulas for area, volume and special right triangles are provided, so you do not need to memorize them.',
          'Read the last line of the question first, so you know exactly what to solve for.',
          'Plug in the answer choices when solving directly would take longer.',
          'Pick simple numbers for variables to test expressions and answer choices.',
          'Watch units and wording such as “percent increase” or “in terms of x.”',
          'For student-produced responses, check the answer format, including fractions and negative numbers.',
          'Make module 1 count by working carefully, because it decides whether you get the harder module 2.',
          'Keep an error log. Note the topic and reason for every mistake, then drill those topics.',
        ],
      },
      {
        heading: 'A weekly practice routine',
        list: [
          'Two or three focused practice sessions on your weakest topics.',
          'One timed module to build pacing.',
          'One full-length practice test every two to three weeks, followed by a full review.',
        ],
      },
    ],
    faq: [
      {
        q: 'Can you use a calculator on SAT Math?',
        a: 'Yes. A calculator is allowed on the entire Digital SAT Math section. The Bluebook app includes a built-in Desmos graphing calculator, and you can also bring an approved calculator of your own.',
      },
      {
        q: 'What is the most common topic on SAT Math?',
        a: 'Algebra and Advanced Math together make up about 70% of SAT Math questions. Linear equations, systems of equations, quadratics and functions appear most often, so they are the best place to start.',
      },
      {
        q: 'How can I improve my SAT Math score quickly?',
        a: 'Focus on the topics you miss most, learn to use Desmos for systems and graphs, and take timed practice modules. Students who already know the content often gain points quickly by fixing careless errors and pacing.',
      },
    ],
    sources: [
      { name: 'College Board: The SAT Math Section', url: 'https://satsuite.collegeboard.org/sat/whats-on-the-test/math' },
    ],
  },
  {
    slug: 'sat-reading-and-writing-question-types',
    title: 'SAT Reading and Writing: Question Types and How to Answer Each One',
    metaTitle: 'SAT Reading & Writing Question Types Explained | ACT SAT GO',
    description:
      'The four content domains and the main question types on the Digital SAT Reading and Writing section, with a strategy for each.',
    published: '2026-10-11',
    updated: '2026-10-11',
    tag: 'SAT',
    answer:
      'The Digital SAT Reading and Writing section has 54 questions in four domains: Craft and Structure, Information and Ideas, Standard English Conventions, and Expression of Ideas. Every question comes with its own short passage, so the best strategy is to read the question first, then read the passage looking only for what the question needs.',
    sections: [
      {
        heading: 'The four content domains',
        table: {
          head: ['Domain', 'Share of questions', 'What it tests'],
          rows: [
            ['Craft and Structure', 'About 28%', 'Words in context, text structure and purpose, connections between two texts'],
            ['Information and Ideas', 'About 26%', 'Central ideas, details, evidence (text and data) and inferences'],
            ['Standard English Conventions', 'About 26%', 'Grammar, punctuation and sentence structure'],
            ['Expression of Ideas', 'About 20%', 'Transitions and combining information from notes'],
          ],
        },
      },
      {
        heading: 'Question types and how to answer them',
        list: [
          'Words in context: predict a word for the blank before looking at the choices, then pick the closest match.',
          'Text structure and purpose: ask what the author is doing, such as explaining, arguing or contrasting.',
          'Cross-text connections: summarise each text’s position in a few words, then compare.',
          'Central ideas and details: the right answer is supported by the whole passage, not one line.',
          'Command of evidence (textual): choose the quotation that directly supports the stated claim.',
          'Command of evidence (quantitative): read the table or graph carefully and match the exact numbers to the claim.',
          'Inferences: choose the ending that must be true based on the passage, not one that might be true.',
          'Boundaries: identify whether you are joining clauses, and apply comma, semicolon and colon rules.',
          'Form, structure and sense: check verb tense, subject-verb agreement and pronoun agreement.',
          'Transitions: work out the logical relationship between sentences, such as contrast, cause or example.',
          'Rhetorical synthesis: re-read the stated goal and pick the answer that meets it using only the notes.',
        ],
      },
      {
        heading: 'Pacing tips',
        list: [
          'You have about 71 seconds per question, so do not get stuck on one passage.',
          'Grammar and transition questions are usually fastest, so make sure you bank those points.',
          'Flag slow questions and return to them before the module ends.',
        ],
      },
    ],
    faq: [
      {
        q: 'How many questions are on SAT Reading and Writing?',
        a: 'The Reading and Writing section has 54 questions in 64 minutes, split into two modules of 27 questions and 32 minutes each. Each question has its own short passage or pair of passages.',
      },
      {
        q: 'What grammar rules are tested on the SAT?',
        a: 'The SAT tests sentence boundaries (commas, semicolons, colons and run-ons) and form, structure and sense, including subject-verb agreement, verb tense, pronouns, possessives and modifiers.',
      },
      {
        q: 'How can I improve my SAT Reading and Writing score?',
        a: 'Learn the grammar rules that are tested, practise each question type separately, and review every mistake to see whether it came from a rule, vocabulary or reading the passage too quickly. Timed practice in Bluebook builds pacing.',
      },
    ],
    sources: [
      { name: 'College Board: The SAT Reading and Writing Section', url: 'https://satsuite.collegeboard.org/sat/whats-on-the-test/reading-writing' },
    ],
  },
  {
    slug: 'online-vs-in-person-sat-tutoring',
    title: 'Online vs In-Person SAT Tutoring: Which Works Better?',
    metaTitle: 'Online vs In-Person SAT Tutoring: Which Works Better? | ACT SAT GO',
    description:
      'How online and in-person SAT and ACT tutoring compare on results, convenience, tutor choice and cost, and how to choose the right option for your child.',
    published: '2026-10-11',
    updated: '2026-10-11',
    tag: 'SAT & ACT',
    answer:
      'Online SAT tutoring works as well as in-person tutoring for most students, because the Digital SAT itself is taken on a screen. Online tutoring also gives you a much wider choice of specialist tutors and saves travel time. In-person tutoring can suit younger students or those who struggle to focus on screens. What matters most is a specialist tutor, a clear plan and regular practice tests.',
    sections: [
      {
        heading: 'Side-by-side comparison',
        table: {
          head: ['', 'Online tutoring', 'In-person tutoring'],
          rows: [
            ['Tutor choice', 'Any qualified tutor, anywhere', 'Limited to tutors nearby'],
            ['Convenience', 'No travel; easy to fit around school and activities', 'Travel time for one side'],
            ['Matches the test format', 'Yes: practice on screen, like the Digital SAT', 'Partly: needs extra on-screen practice'],
            ['Focus and engagement', 'Best for students comfortable on screens', 'Can help students who are easily distracted'],
            ['Cost', 'Often lower, with no travel costs', 'Often higher in many areas'],
          ],
        },
      },
      {
        heading: 'What matters more than the format',
        list: [
          'A tutor who specialises in the exact test: the Digital SAT or the enhanced ACT.',
          'A diagnostic test at the start, so the plan targets real gaps.',
          'Full-length practice tests with score reports during preparation.',
          'Homework between sessions, reviewed by the tutor.',
          'Regular updates for parents on scores and progress.',
        ],
      },
      {
        heading: 'How to make online tutoring work well',
        list: [
          'Use a laptop or desktop rather than a phone, with a stable internet connection.',
          'Choose a quiet space and keep the camera on.',
          'Use a shared whiteboard or screen so the tutor can see your working.',
          'Practise in Bluebook between sessions to get used to the real test interface.',
        ],
      },
    ],
    faq: [
      {
        q: 'Is online SAT tutoring effective?',
        a: 'Yes. Online SAT tutoring is effective for most students, especially since the Digital SAT is taken on a computer. The tutor’s expertise, a personalised plan and regular practice tests matter far more than whether sessions are online or in person.',
      },
      {
        q: 'Is online tutoring cheaper than in-person tutoring?',
        a: 'Often, yes. Online tutoring removes travel costs and gives you access to a wider range of tutors and price points. At ACT SAT GO, all programs are live, 1-on-1 and online, with fees listed on the SAT and ACT pages.',
      },
      {
        q: 'What should I look for in an online SAT tutor?',
        a: 'Look for a tutor who specialises in the Digital SAT, starts with a diagnostic test, sets homework after every session, includes full-length practice tests with score reports, and keeps parents updated on progress.',
      },
    ],
  },
  {
    slug: 'psat-nmsqt-national-merit',
    title: 'PSAT/NMSQT Explained: Scores, National Merit and How to Prepare',
    metaTitle: 'PSAT/NMSQT and National Merit Explained (2026) | ACT SAT GO',
    description:
      'What the digital PSAT/NMSQT is, how it is scored, how the National Merit Selection Index works, and how juniors can prepare to qualify.',
    published: '2026-10-11',
    updated: '2026-10-11',
    tag: 'SAT',
    answer:
      'The PSAT/NMSQT is a shorter version of the Digital SAT, scored from 320 to 1520 and taken in the fall. For juniors it is also the qualifying test for the National Merit Scholarship Program: about 16,000 of the roughly 1.5 million entrants are named Semifinalists, based on a Selection Index and a cutoff that differs by state.',
    sections: [
      {
        heading: 'PSAT/NMSQT at a glance',
        table: {
          head: ['', 'PSAT/NMSQT'],
          rows: [
            ['Format', 'Digital and adaptive, taken in the Bluebook app at school'],
            ['Sections', 'Reading and Writing, then Math'],
            ['Length', 'About 2 hours 14 minutes'],
            ['Score range', '320 to 1520 (160 to 760 per section)'],
            ['When', 'October, through your high school'],
            ['National Merit eligibility', 'Scores from the junior-year test only'],
          ],
        },
      },
      {
        heading: 'How the National Merit Selection Index works',
        paragraphs: [
          'National Merit does not use your total score. It uses a Selection Index: double your Reading and Writing section score, add your Math section score, then divide by 10. The index runs from 48 to 228, so Reading and Writing counts twice as much as Math.',
          'Each state has its own Semifinalist cutoff, set so that the number of Semifinalists matches the state’s share of graduating seniors. About 34,000 more high scorers are named Commended Students. Semifinalists who meet the remaining requirements, including a confirming SAT or ACT score, can become Finalists and compete for National Merit Scholarships.',
        ],
      },
      {
        heading: 'How to prepare for the PSAT',
        list: [
          'Start in the summer before junior year, so preparation also counts toward the SAT.',
          'Take a full practice PSAT in the Bluebook app to get a baseline score.',
          'Focus extra time on Reading and Writing, since it is doubled in the Selection Index.',
          'Practise with the built-in Desmos calculator so Math feels familiar on test day.',
          'Review every mistake by question type rather than just doing more questions.',
        ],
      },
      {
        heading: 'Does the PSAT matter if you are not aiming for National Merit?',
        paragraphs: [
          'Colleges do not see PSAT scores, so a low PSAT has no effect on admissions. Its real value is as a free, official practice run of the Digital SAT that shows which skills need work before the real test.',
        ],
      },
    ],
    faq: [
      {
        q: 'What is a good PSAT score?',
        a: 'A score above about 1200 is above average for juniors. For National Merit recognition you usually need a Selection Index in roughly the top 3 to 4 percent of test takers, which means a total score well above 1400 in most states.',
      },
      {
        q: 'Do colleges see PSAT scores?',
        a: 'No. PSAT scores are not sent to colleges and do not affect admissions. Only National Merit recognition, which you can list on applications, comes from the PSAT.',
      },
      {
        q: 'Can sophomores take the PSAT/NMSQT?',
        a: 'Yes, many schools offer it to sophomores as practice. Only the junior-year score counts toward National Merit.',
      },
      {
        q: 'Is the PSAT the same as the SAT?',
        a: 'It uses the same digital, adaptive format and question types, but it is slightly shorter and scored on a 320 to 1520 scale instead of 400 to 1600.',
      },
    ],
    sources: [
      { name: 'College Board: PSAT/NMSQT', url: 'https://satsuite.collegeboard.org/psat-nmsqt' },
      { name: 'National Merit Scholarship Corporation', url: 'https://www.nationalmerit.org/' },
    ],
  },
  {
    slug: 'sat-act-superscore',
    title: 'What Is a Superscore? How SAT and ACT Superscoring Works',
    metaTitle: 'SAT and ACT Superscoring Explained | ACT SAT GO',
    description:
      'How superscoring combines your best section scores across test dates, which tests offer it, and how to use it when planning retakes.',
    published: '2026-10-11',
    updated: '2026-10-11',
    tag: 'SAT & ACT',
    answer:
      'A superscore combines your best section scores from different test dates into one new total. For the SAT, a college takes your highest Reading and Writing score and your highest Math score. For the ACT, ACT itself calculates a superscore from your best section scores once you have tested more than once. Not every college superscores, so check each school’s policy.',
    sections: [
      {
        heading: 'A superscore example',
        table: {
          head: ['', 'Reading and Writing', 'Math', 'Total'],
          rows: [
            ['March SAT', '680', '640', '1320'],
            ['June SAT', '650', '700', '1350'],
            ['Superscore', '680', '700', '1380'],
          ],
        },
      },
      {
        heading: 'How superscoring works on each test',
        list: [
          'SAT: the college picks your highest section scores from the score reports you send. You can use Score Choice to send only some test dates, unless the college asks for all scores.',
          'ACT: ACT reports a superscore built from your best English, Math and Reading scores across dates. Your composite is then the average of those best scores.',
          'Policies vary: some colleges superscore, some consider your single highest test date, and a few ask for every score you have.',
        ],
      },
      {
        heading: 'How to use superscoring in your test plan',
        paragraphs: [
          'Superscoring rewards focused retakes. If your first test shows a strong Math score but weaker Reading and Writing, your next round of preparation can concentrate on Reading and Writing, because the Math score is already banked at colleges that superscore.',
          'Plan for two or three attempts with time to study in between. Testing again without new preparation rarely moves a score much.',
        ],
      },
    ],
    faq: [
      {
        q: 'Do all colleges accept superscores?',
        a: 'No. Many colleges superscore the SAT and ACT, but some use your highest single test date and a few require all scores. Each college lists its policy on its admissions website.',
      },
      {
        q: 'Can I superscore across the SAT and ACT?',
        a: 'No. Superscores only combine sections from the same test. Colleges compare SAT and ACT scores using the official concordance tables.',
      },
      {
        q: 'Does superscoring mean I should take the SAT many times?',
        a: 'Not necessarily. Two or three well-prepared attempts are usually enough. Very long testing histories add little and take time away from applications and coursework.',
      },
    ],
    sources: [
      { name: 'ACT: Superscoring', url: 'https://www.act.org/content/act/en/students-and-parents/high-school-success/testing-advice-for-the-act/superscore-faqs.html' },
      { name: 'College Board: Sending SAT Scores', url: 'https://satsuite.collegeboard.org/scores/sending-sat-scores/weekend' },
    ],
  },
  {
    slug: 'how-many-times-take-sat',
    title: 'How Many Times Should You Take the SAT or ACT?',
    metaTitle: 'How Many Times Should You Take the SAT or ACT? | ACT SAT GO',
    description:
      'The limits on SAT and ACT retakes, why two or three attempts is the usual plan, and how to time retakes around junior and senior year.',
    published: '2026-10-11',
    updated: '2026-10-11',
    tag: 'SAT & ACT',
    answer:
      'Most students should plan to take the SAT or ACT two or three times. The College Board has no limit on SAT attempts, and ACT allows up to 12. A first test in the spring of junior year, a retake in early summer or August, and an optional final attempt in early senior fall fits most application deadlines.',
    sections: [
      {
        heading: 'A typical retake plan',
        table: {
          head: ['Attempt', 'When', 'Goal'],
          rows: [
            ['First test', 'Spring of junior year', 'Get an official baseline after initial prep'],
            ['Second test', 'June or August', 'Raise weaker sections with targeted practice'],
            ['Third test (optional)', 'September to early November of senior year', 'Last chance before early application deadlines'],
          ],
        },
      },
      {
        heading: 'When a retake makes sense',
        list: [
          'Your score is below the middle range at colleges on your list.',
          'Your practice test scores are clearly higher than your official score.',
          'One section is much weaker than the other and you have time to work on it.',
          'A college you are applying to superscores, so a strong section from a second test can raise your total.',
        ],
      },
      {
        heading: 'When to stop testing',
        paragraphs: [
          'Stop when your score is at or above the middle 50 percent range for your target colleges, or when two well-prepared attempts land within a few points of each other. At that point, time is usually better spent on grades, essays and activities.',
        ],
      },
    ],
    faq: [
      {
        q: 'Does taking the SAT many times look bad?',
        a: 'Two or three attempts is normal and does not look bad. With Score Choice and superscoring, most colleges focus on your best results. A very long list of attempts can look unfocused at colleges that require all scores.',
      },
      {
        q: 'How much do scores improve on a retake?',
        a: 'Many students improve on their second attempt because they are more familiar with the test. The biggest gains come from targeted preparation between attempts, not from retesting alone.',
      },
      {
        q: 'Is there a limit on ACT attempts?',
        a: 'Yes. ACT allows up to 12 attempts. Testing through a school or state program does not count toward that limit.',
      },
    ],
    sources: [
      { name: 'College Board: SAT Dates and Deadlines', url: 'https://satsuite.collegeboard.org/sat/dates-deadlines' },
    ],
  },
  {
    slug: 'desmos-calculator-digital-sat',
    title: 'How to Use the Desmos Calculator on the Digital SAT',
    metaTitle: 'Desmos Calculator on the Digital SAT: Tips and Tricks | ACT SAT GO',
    description:
      'How the built-in Desmos graphing calculator works on the Digital SAT, which question types it solves fastest, and how to practise with it.',
    published: '2026-10-11',
    updated: '2026-10-11',
    tag: 'SAT',
    answer:
      'The Digital SAT has a Desmos graphing calculator built into the Bluebook app, and you can use it on every Math question. It is fastest for systems of equations, quadratics, intersections and checking answer choices. You may also bring your own approved calculator, but students who practise with Desmos usually save the most time.',
    sections: [
      {
        heading: 'Where Desmos saves the most time',
        table: {
          head: ['Question type', 'What to do in Desmos'],
          rows: [
            ['Systems of equations', 'Type both equations and click the intersection point'],
            ['Quadratics', 'Graph the function to read the vertex, roots and y-intercept'],
            ['Number of solutions', 'Graph both sides and count the intersections'],
            ['Inequalities', 'Graph them and test which answer choice sits in the shaded region'],
            ['Unknown constants', 'Use a slider for the constant and watch the graph change'],
            ['Statistics', 'Enter a list and use mean() or median()'],
          ],
        },
      },
      {
        heading: 'Desmos tips',
        list: [
          'Type equations exactly as written. Desmos accepts y = and x = forms and most standard notation.',
          'Click a curve to see key points such as roots, maximums and intersections.',
          'Use the zoom buttons or adjust the axes when a point is off screen.',
          'Know when not to use it: simple arithmetic and one-step algebra are often faster by hand.',
          'Practise with Desmos in Bluebook practice tests, so the layout is familiar on test day.',
        ],
      },
      {
        heading: 'Desmos or your own calculator?',
        paragraphs: [
          'You can bring an approved graphing or scientific calculator, and some students prefer physical buttons. Desmos is usually faster for anything involving graphs, which covers a large share of the Algebra and Advanced Math questions.',
        ],
      },
    ],
    faq: [
      {
        q: 'Can you use Desmos on the whole SAT Math section?',
        a: 'Yes. The Desmos graphing calculator is available on every question in both Math modules of the Digital SAT.',
      },
      {
        q: 'Is using Desmos cheating?',
        a: 'No. Desmos is built into the official Bluebook testing app and is allowed for every Math question.',
      },
      {
        q: 'Can I bring my own calculator to the Digital SAT?',
        a: 'Yes, as long as it is on the College Board’s approved calculator list. You can switch between your calculator and Desmos during the test.',
      },
    ],
    sources: [
      { name: 'College Board: Calculator Policy', url: 'https://satsuite.collegeboard.org/digital/what-to-bring-do/calculator-policy' },
    ],
  },
  {
    slug: 'sat-act-accommodations',
    title: 'SAT and ACT Accommodations: Extended Time and How to Apply',
    metaTitle: 'SAT and ACT Accommodations: Extended Time and How to Apply | ACT SAT GO',
    description:
      'Which testing accommodations the SAT and ACT offer, who qualifies, and the steps and deadlines for requesting extended time or other support.',
    published: '2026-10-11',
    updated: '2026-10-11',
    tag: 'SAT & ACT',
    answer:
      'Students with a documented disability can request accommodations such as extended time, extra breaks or assistive technology. For the SAT, the request goes through your school’s SSD coordinator to the College Board, ideally at least seven weeks before the test. For the ACT, you register first, then your school submits the request. Approved College Board accommodations also apply to the PSAT and AP exams.',
    sections: [
      {
        heading: 'Common accommodations',
        table: {
          head: ['Accommodation', 'What it means'],
          rows: [
            ['Extended time', 'Usually 50% or 100% more time per section'],
            ['Extra or longer breaks', 'Additional rest between sections'],
            ['Assistive technology', 'Screen readers or other approved tools'],
            ['Reading and seeing support', 'Larger text, magnification or color contrast'],
            ['Small-group setting', 'Testing in a quieter room with fewer students'],
          ],
        },
      },
      {
        heading: 'How to request SAT accommodations',
        list: [
          'Talk to your school’s SSD coordinator, usually in the counseling office.',
          'Give the coordinator your documentation, such as an IEP, 504 plan or evaluation.',
          'The coordinator submits the request through College Board SSD Online.',
          'Submit at least seven weeks before your test date, since review can take that long.',
          'Once approved, accommodations generally carry over to future SAT Suite and AP exams.',
        ],
      },
      {
        heading: 'How to request ACT accommodations',
        paragraphs: [
          'Register for a national ACT test date first. Then ask your school’s test accommodations coordinator to submit your request through ACT’s accommodations system, along with supporting documentation. Do this well before the registration deadline so a decision arrives in time.',
        ],
      },
    ],
    faq: [
      {
        q: 'Do colleges know if I had extended time?',
        a: 'No. Score reports sent to colleges do not show whether you tested with accommodations.',
      },
      {
        q: 'Who qualifies for SAT accommodations?',
        a: 'Students with a documented disability that affects test taking, such as ADHD, a learning disability or a physical condition. Most students with an IEP or 504 plan that includes testing accommodations at school are approved.',
      },
      {
        q: 'How early should I apply?',
        a: 'At least seven weeks before the SAT you plan to take. Applying in the fall of sophomore or junior year means accommodations are in place for the PSAT, SAT and AP exams.',
      },
    ],
    sources: [
      { name: 'College Board: Accommodations', url: 'https://accommodations.collegeboard.org/' },
      { name: 'College Board: When to submit accommodation requests', url: 'https://satsuite.collegeboard.org/help-center/when-should-i-submit-requests-accommodations' },
      { name: 'ACT: Accommodations', url: 'https://www.act.org/content/act/en/products-and-services/the-act/registration/accommodations.html' },
    ],
  },
  {
    slug: 'how-to-send-sat-scores',
    title: 'How to Send SAT and ACT Scores to Colleges',
    metaTitle: 'How to Send SAT and ACT Scores to Colleges | ACT SAT GO',
    description:
      'Free score reports, Score Choice, self-reported scores and deadlines: a step-by-step guide to sending SAT and ACT scores to colleges.',
    published: '2026-10-11',
    updated: '2026-10-11',
    tag: 'College Admissions',
    answer:
      'You send official SAT scores from your College Board account and ACT scores from your MyACT account. The SAT includes four free score reports if you choose colleges within nine days of the test, and the ACT sends free reports to the colleges you pick when you register. After that, each report costs a fee. Many colleges now let you self-report scores on the application and only ask for official scores after you enroll.',
    sections: [
      {
        heading: 'SAT vs ACT score sending',
        table: {
          head: ['', 'SAT', 'ACT'],
          rows: [
            ['Free reports', 'Up to 4, if chosen within 9 days after the test', 'Sent to the colleges you pick when you register'],
            ['Choose which dates to send', 'Yes, with Score Choice', 'Yes, by test date'],
            ['Superscore report', 'Colleges build it from the reports you send', 'ACT can send a superscore'],
            ['Where to send from', 'College Board account', 'MyACT account'],
          ],
        },
      },
      {
        heading: 'Step by step',
        list: [
          'Check each college’s testing policy: required, optional, or test-blind.',
          'Check whether the college accepts self-reported scores on the application.',
          'Decide which test dates to send, if the college allows Score Choice.',
          'Use your free score reports where you can, and send others well before deadlines.',
          'Confirm in each college’s applicant portal that scores have arrived.',
        ],
      },
      {
        heading: 'Fee waivers',
        paragraphs: [
          'Students who are eligible for an SAT or ACT fee waiver also get unlimited or extra free score reports. Ask your school counselor if you qualify.',
        ],
      },
    ],
    faq: [
      {
        q: 'Should I use the four free score reports?',
        a: 'Usually yes, if you already know a few colleges you will apply to. Sending scores you are unhappy with is rarely a problem, because most colleges superscore or consider your best result.',
      },
      {
        q: 'What is self-reporting?',
        a: 'Many colleges let you enter your scores on the application for free and only require an official score report if you enroll. Check each college’s admissions website.',
      },
      {
        q: 'How long does it take for scores to arrive?',
        a: 'Electronic score reports usually reach colleges within about two weeks. Send them at least a few weeks before the application deadline.',
      },
    ],
    sources: [
      { name: 'College Board: Sending SAT Scores', url: 'https://satsuite.collegeboard.org/scores/sending-sat-scores/weekend' },
      { name: 'ACT: Sending Your Scores', url: 'https://www.act.org/content/act/en/products-and-services/the-act/scores/sending-your-scores.html' },
    ],
  },
  {
    slug: 'free-sat-practice-tests',
    title: 'The Best Free SAT and ACT Practice Tests',
    metaTitle: 'Best Free SAT and ACT Practice Tests (2026) | ACT SAT GO',
    description:
      'Where to find free, official Digital SAT and enhanced ACT practice tests, and how to use them to raise your score.',
    published: '2026-10-11',
    updated: '2026-10-11',
    tag: 'SAT & ACT',
    answer:
      'The best free practice tests come from the test makers. For the SAT, use the full-length adaptive practice tests in the College Board’s Bluebook app, plus Khan Academy and the SAT Suite Question Bank. For the ACT, use the free practice test on ACT’s website. ACT SAT GO also offers free timed SAT and ACT practice tests with a score report.',
    sections: [
      {
        heading: 'Free official resources',
        table: {
          head: ['Resource', 'Test', 'What you get'],
          rows: [
            ['Bluebook practice tests', 'SAT and PSAT', 'Full-length adaptive tests in the real testing app'],
            ['Khan Academy', 'SAT', 'Free lessons and practice by skill'],
            ['SAT Suite Question Bank', 'SAT', 'Thousands of official questions you can filter by skill and difficulty'],
            ['ACT practice test', 'ACT', 'A free full-length official practice test'],
            ['ACT SAT GO free test', 'SAT and ACT', 'A timed practice test with a score report'],
          ],
        },
      },
      {
        heading: 'How to use practice tests well',
        list: [
          'Take the first test early to get a baseline, then build a study plan from it.',
          'Take each test in one sitting, timed, in a quiet room.',
          'Spend as long reviewing a test as taking it. Write down why you missed each question.',
          'Space full tests two to three weeks apart and practise weak skills in between.',
          'Save one official test for the final week before your exam.',
        ],
      },
    ],
    faq: [
      {
        q: 'How many practice tests should I take?',
        a: 'Most students benefit from four to six full-length tests, spread across their preparation, with careful review after each one.',
      },
      {
        q: 'Are Bluebook practice tests accurate?',
        a: 'Yes. They are made by the College Board, use the same adaptive format as the real test, and give the most reliable score prediction.',
      },
      {
        q: 'Are unofficial practice tests worth using?',
        a: 'They can help with extra practice, but question style and difficulty vary. Use official tests to measure your score and unofficial material for drilling skills.',
      },
    ],
    sources: [
      { name: 'College Board: Bluebook practice tests', url: 'https://satsuite.collegeboard.org/practice/practice-tests' },
      { name: 'College Board: SAT Suite Question Bank', url: 'https://satsuiteeducatorquestionbank.collegeboard.org/' },
      { name: 'ACT: Free practice test', url: 'https://www.act.org/content/act/en/products-and-services/the-act/test-preparation.html' },
    ],
  },
  {
    slug: 'act-math-tips',
    title: 'ACT Math Tips: How to Raise Your Score on the Enhanced ACT',
    metaTitle: 'ACT Math Tips for the Enhanced ACT | ACT SAT GO',
    description:
      'What the enhanced ACT Math section covers, how its timing works, and practical strategies to answer more questions correctly.',
    published: '2026-10-11',
    updated: '2026-10-11',
    tag: 'ACT',
    answer:
      'The enhanced ACT Math section has 45 questions in 50 minutes, each with four answer choices, and a calculator is allowed throughout. To raise your score, learn the core formulas the test does not give you, pace yourself so the harder later questions get enough time, and answer every question, since there is no penalty for guessing.',
    sections: [
      {
        heading: 'ACT Math at a glance',
        table: {
          head: ['', 'Enhanced ACT Math'],
          rows: [
            ['Questions', '45'],
            ['Time', '50 minutes, about 67 seconds per question'],
            ['Answer choices', '4 per question'],
            ['Calculator', 'Allowed on the whole section'],
            ['Formula sheet', 'Not provided'],
            ['Wrong-answer penalty', 'None'],
          ],
        },
      },
      {
        heading: 'Strategies that work',
        list: [
          'Memorise key formulas: area and volume, the Pythagorean theorem, slope, distance and midpoint, and SOH CAH TOA.',
          'Questions tend to get harder, so move quickly through the early ones to bank time for later.',
          'Mark and skip a question that takes more than a minute and a half, then come back.',
          'Plug in the answer choices or pick numbers when the algebra looks messy.',
          'Never leave a question blank. With four choices, a guess has a one in four chance.',
          'Practise the topics that appear most: algebra, functions, geometry and basic statistics.',
        ],
      },
      {
        heading: 'How ACT Math differs from SAT Math',
        paragraphs: [
          'ACT Math covers a little more geometry and trigonometry and gives less time per question than the SAT. The SAT is adaptive and has the built-in Desmos calculator. Students who like fast, direct questions often prefer ACT Math.',
        ],
      },
    ],
    faq: [
      {
        q: 'Is there a formula sheet on the ACT?',
        a: 'No. The ACT does not provide formulas, so you need to know the common geometry, algebra and trigonometry formulas yourself.',
      },
      {
        q: 'What calculator can I use on the ACT?',
        a: 'Most graphing and scientific calculators are allowed, but calculators with computer algebra systems, such as the TI-89, are not. Check ACT’s calculator policy before test day.',
      },
      {
        q: 'What is a good ACT Math score?',
        a: 'The national average ACT Math score is about 19. A score of 25 or higher is above average, and selective colleges often look for 30 or more.',
      },
    ],
    sources: [
      { name: 'ACT: The Enhanced ACT Explained', url: 'https://counselorblog.act.org/the-enhanced-act-explained' },
    ],
  },
  {
    slug: 'act-english-reading-tips',
    title: 'ACT English and Reading Tips for the Enhanced ACT',
    metaTitle: 'ACT English and Reading Tips (Enhanced ACT) | ACT SAT GO',
    description:
      'The grammar rules ACT English tests most, how to approach ACT Reading passages, and timing strategies for both sections.',
    published: '2026-10-11',
    updated: '2026-10-11',
    tag: 'ACT',
    answer:
      'On the enhanced ACT, English has 50 questions in 35 minutes and Reading has 36 questions in 40 minutes. For English, learn the small set of grammar rules that appear again and again and choose the shortest correct answer. For Reading, read each passage once for the main idea, then go back to the text to prove every answer.',
    sections: [
      {
        heading: 'English and Reading at a glance',
        table: {
          head: ['', 'English', 'Reading'],
          rows: [
            ['Questions', '50', '36'],
            ['Time', '35 minutes', '40 minutes'],
            ['What it tests', 'Grammar, punctuation, sentence structure and style', 'Understanding, inference and author’s purpose'],
            ['Counts toward composite', 'Yes', 'Yes'],
          ],
        },
      },
      {
        heading: 'ACT English tips',
        list: [
          'Master commas, semicolons, colons and apostrophes. They account for many questions.',
          'Check subject-verb agreement and verb tense against the rest of the sentence.',
          'When two answers are both correct, choose the shorter one. ACT rewards concise writing.',
          'For questions that ask about a passage’s purpose, reread the sentences around the underlined part.',
        ],
      },
      {
        heading: 'ACT Reading tips',
        list: [
          'Skim each passage for the main idea and the author’s attitude before the questions.',
          'Find the line in the text that supports your answer. If you cannot point to it, it is probably wrong.',
          'Do your strongest passage type first if timing is tight.',
          'Watch for answer choices that are true but do not answer the question asked.',
        ],
      },
    ],
    faq: [
      {
        q: 'What grammar rules are on the ACT?',
        a: 'The most tested rules are punctuation (commas, semicolons, colons, dashes, apostrophes), subject-verb agreement, verb tense, pronouns, modifiers and sentence boundaries. Concision and transitions are also common.',
      },
      {
        q: 'How do I finish ACT Reading in time?',
        a: 'Read for the main idea rather than every detail, answer line-reference questions first, and practise timed passages until you can finish each one in about nine minutes.',
      },
      {
        q: 'Is ACT English easier than SAT Reading and Writing?',
        a: 'ACT English is more focused on grammar and gives less time per question, while SAT Reading and Writing mixes grammar with short reading questions. Students who are strong at grammar often do well on ACT English.',
      },
    ],
    sources: [
      { name: 'ACT: The Enhanced ACT Explained', url: 'https://counselorblog.act.org/the-enhanced-act-explained' },
    ],
  },
  {
    slug: 'good-ap-score-college-credit',
    title: 'What Is a Good AP Score, and Will It Earn College Credit?',
    metaTitle: 'What Is a Good AP Score? AP Credit Explained | ACT SAT GO',
    description:
      'How AP exams are scored from 1 to 5, what scores colleges accept for credit, when scores come out, and how AP fits with the SAT and ACT.',
    published: '2026-10-11',
    updated: '2026-10-11',
    tag: 'AP',
    answer:
      'AP exams are scored from 1 to 5. A 3 is considered passing and earns credit at many colleges, while selective colleges often require a 4 or 5. Credit policies are set by each college and can differ by subject, so check the AP credit policy of each school on your list.',
    sections: [
      {
        heading: 'What each AP score means',
        table: {
          head: ['Score', 'College Board description', 'Credit'],
          rows: [
            ['5', 'Extremely well qualified', 'Credit at most colleges'],
            ['4', 'Very well qualified', 'Credit at most colleges'],
            ['3', 'Qualified', 'Credit at many colleges'],
            ['2', 'Possibly qualified', 'Rarely earns credit'],
            ['1', 'No recommendation', 'No credit'],
          ],
        },
      },
      {
        heading: 'Key AP dates and rules',
        list: [
          'AP exams are held over two weeks in May.',
          'Scores are usually released in early July.',
          'Your free score send goes to one college or scholarship program you choose in My AP, usually by June 20.',
          'You can ask the College Board to withhold or cancel a score before it is sent.',
        ],
      },
      {
        heading: 'Do AP scores matter for admissions?',
        paragraphs: [
          'AP course grades matter more than AP exam scores for admissions, because they show the rigor of your schedule. Strong exam scores still help, especially at colleges that ask you to self-report them, and they can save time and tuition through credit or placement.',
        ],
      },
    ],
    faq: [
      {
        q: 'Is a 3 a good AP score?',
        a: 'Yes. A 3 means "qualified" and earns credit or placement at many colleges. Highly selective colleges more often require a 4 or 5.',
      },
      {
        q: 'Do I have to send AP scores to colleges?',
        a: 'No. Many colleges let you self-report AP scores on the application, and you only send official scores when you enroll and want credit.',
      },
      {
        q: 'How should I prepare for AP exams?',
        a: 'Learn the exam format for each subject, practise free-response questions with the official scoring guidelines, and take at least one timed practice exam. ACT SAT GO offers free AP exam guides on the resources page.',
      },
    ],
    sources: [
      { name: 'College Board: AP Scores', url: 'https://apstudents.collegeboard.org/about-ap-scores' },
      { name: 'College Board: AP Credit Policy Search', url: 'https://apstudents.collegeboard.org/getting-credit-placement/search-policies' },
    ],
  },
];

export const ARTICLE_BY_SLUG: Record<string, Article> = Object.fromEntries(ARTICLES.map((a) => [a.slug, a]));

export const articlePath = (slug: string) => `/resources/${slug}`;

/** "2026-10-11" -> "October 11, 2026" (UTC, so server and browser agree). */
export function formatArticleDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}
