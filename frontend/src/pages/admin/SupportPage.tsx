import { useState } from 'react';
import { ChevronDown, ChevronUp, LifeBuoy, BookOpen, MessageCircle, Mail, ExternalLink } from 'lucide-react';
import { Card } from '../../components/common/Card';

interface FaqItem { q: string; a: string }

const FAQS: { section: string; items: FaqItem[] }[] = [
  {
    section: 'Test Management',
    items: [
      { q: 'How do I create a new test?', a: 'Go to Test Builder from the sidebar. Enter a title, add sections, and add questions to each section. You can type questions manually or import them from a CSV file. Set the status to "Published" when ready for students.' },
      { q: 'How do I import questions via CSV?', a: 'In the Test Builder, click "Import CSV" next to the "Add Question" button. Download the template, fill it in with your questions (supported types: MCQ, MSQ, NUMERIC), and upload it. Valid rows are previewed before import.' },
      { q: 'Can students retake a test?', a: 'Yes. Each time a student starts a test a new attempt is created. All attempts are recorded and visible in Analytics and the Assignments page.' },
      { q: 'What happens if a student\'s browser crashes?', a: 'Answers are autosaved every few seconds. When the student returns to the test, they can resume from where they left off as long as the section timer hasn\'t expired.' },
    ],
  },
  {
    section: 'Students & Tutors',
    items: [
      { q: 'How do I add a student?', a: 'Navigate to Students in the sidebar and click "Add Student". Fill in the name, email, grade, target score, and optionally assign a tutor. The student will appear immediately and can log in.' },
      { q: 'How do I assign a tutor to a student?', a: 'You can assign a tutor when creating or editing a student record. You can also manage assignments in bulk from the Tutors page by selecting a tutor and clicking "Assign Students".' },
      { q: 'How are weak students identified?', a: 'Students with an average score below 24 (ACT) are flagged in the Tutor Analytics view. Tutors can also see their students\' weakest subjects based on section accuracy.' },
    ],
  },
  {
    section: 'Reports & Analytics',
    items: [
      { q: 'What data does the Reports page show?', a: 'Select a student to see their score trend across all submitted attempts, section-level performance (accuracy and time used), and a breakdown table showing each section\'s stats.' },
      { q: 'Can I export data to CSV?', a: 'Yes. Use the "Export CSV" button on the Reports page to download per-student analytics. The "Students CSV" button exports a summary of all students.' },
      { q: 'How is the score trend calculated?', a: 'The score trend uses all SUBMITTED test attempts for the selected student, ordered by completion date. Each data point is the total raw score for that attempt.' },
    ],
  },
  {
    section: 'Live Monitoring',
    items: [
      { q: 'What does the Monitoring page show?', a: 'It shows all currently IN_PROGRESS test attempts in real time. You can see each student\'s progress, time remaining, and any tab-switch events that have been logged.' },
      { q: 'What triggers a tab-switch flag?', a: 'When tab-tracking is enabled for a test, every time a student switches away from the test window a cheating event is logged. Students with 3 or more switches are highlighted in red.' },
    ],
  },
  {
    section: 'Account & Settings',
    items: [
      { q: 'How do I update my profile name?', a: 'Go to Settings → Profile, update your display name, and click Save Profile.' },
      { q: 'Who can access the Super Admin console?', a: 'Only users with the "super_admin" role can access the User Management and System tabs in the platform console.' },
    ],
  },
];

function FaqAccordion({ items }: { items: FaqItem[] }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div className="divide-y divide-slate-100">
      {items.map((item, i) => (
        <div key={i}>
          <button onClick={() => setOpen(open === i ? null : i)}
            className="w-full flex items-start justify-between gap-3 py-4 text-left">
            <span className="text-sm font-medium text-slate-800">{item.q}</span>
            {open === i ? <ChevronUp size={16} className="text-slate-400 flex-shrink-0 mt-0.5" /> : <ChevronDown size={16} className="text-slate-400 flex-shrink-0 mt-0.5" />}
          </button>
          {open === i && (
            <p className="pb-4 text-sm text-slate-600 leading-relaxed">{item.a}</p>
          )}
        </div>
      ))}
    </div>
  );
}

export function SupportPage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-slate-900">Help & Support</h1>
        <p className="text-slate-500 text-sm mt-0.5">Frequently asked questions and contact options</p>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { icon: <BookOpen size={18} />, title: 'Documentation', desc: 'Full admin guide', color: 'blue' },
          { icon: <MessageCircle size={18} />, title: 'Live Chat', desc: 'Mon–Fri, 9am–6pm', color: 'emerald' },
          { icon: <Mail size={18} />, title: 'Email Support', desc: 'support@actsat.com', color: 'purple' },
        ].map((item) => (
          <Card key={item.title} padding="sm">
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                item.color === 'blue' ? 'bg-blue-50 text-blue-600' :
                item.color === 'emerald' ? 'bg-emerald-50 text-emerald-600' : 'bg-purple-50 text-purple-600'
              }`}>
                {item.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                <p className="text-xs text-slate-500">{item.desc}</p>
              </div>
              <ExternalLink size={13} className="text-slate-300 flex-shrink-0" />
            </div>
          </Card>
        ))}
      </div>

      {/* FAQs */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <LifeBuoy size={16} className="text-slate-400" />
          <h2 className="text-base font-semibold text-slate-900">Frequently Asked Questions</h2>
        </div>
        {FAQS.map((section) => (
          <Card key={section.section} padding="sm">
            <h3 className="text-sm font-semibold text-slate-700 mb-1 pb-2 border-b border-slate-100">{section.section}</h3>
            <FaqAccordion items={section.items} />
          </Card>
        ))}
      </div>
    </div>
  );
}
