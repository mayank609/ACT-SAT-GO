import { useEffect, useState } from 'react';
import { Header } from '../components/Header';
import { Brand } from '../components/Brand';
import { useScrollReveal } from '../hooks/useScrollReveal';
import { fetchBlogs, type BlogPost } from '../admin/api';

// Image assets
import heroImg from '../../images/resouces hero.png';
import satReviewImg from '../assets/sat_review_cover.png';
import actChecklistImg from '../assets/act_checklist_cover.png';
import apOverviewImg from '../assets/ap_overview_cover.png';
import collegeTimelineImg from '../assets/college_timeline_cover.png';
import blogStudyHabitsImg from '../assets/6.jpeg';
import blogSatDiffImg from '../assets/7.jpeg';
import blogCollegeEssayImg from '../assets/8.jpeg';
import blogApWorthImg from '../assets/9.jpeg';

// Custom icons
function IconSearch() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function IconDownload() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function IconBook() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  );
}

function IconGraduation() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
      <path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5" />
    </svg>
  );
}

function IconClipboard() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    </svg>
  );
}

function IconBuilding() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
      <line x1="9" y1="22" x2="9" y2="16" />
      <line x1="15" y1="22" x2="15" y2="16" />
      <line x1="9" y1="16" x2="15" y2="16" />
      <path d="M8 6h2v2H8zM14 6h2v2h-2zM8 11h2v2H8zM14 11h2v2h-2z" />
    </svg>
  );
}

function IconBulb() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A5 5 0 0 0 8 8c0 1 .4 2.5 1.5 3.5.7.8 1.3 1.5 1.5 2.5" />
      <line x1="9" y1="18" x2="15" y2="18" />
      <line x1="10" y1="22" x2="14" y2="22" />
    </svg>
  );
}

function IconVideo() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
      <polygon points="10 7 15 10 10 13" fill="currentColor" stroke="none" />
    </svg>
  );
}


function IconSparkle() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v18M3 12h18M12 3l3 3M12 21l-3-3M3 12l3-3M21 12l-3 3" />
    </svg>
  );
}

function IconShield() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

export function ResourcesPage() {
  useScrollReveal();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeTopic, setActiveTopic] = useState('');
  const [email, setEmail] = useState('');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [blogs, setBlogs] = useState<BlogPost[]>([]);

  const getBlogImage = (post: BlogPost) => {
    if (post.image) return post.image;
    const tag = post.tag.toLowerCase();
    if (tag.includes('tips') || tag.includes('habit')) return blogStudyHabitsImg;
    if (tag.includes('sat') || tag.includes('act')) return blogSatDiffImg;
    if (tag.includes('essay') || tag.includes('college')) return blogCollegeEssayImg;
    if (tag.includes('ap')) return blogApWorthImg;
    return blogStudyHabitsImg;
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchBlogs();
        if (!cancelled) {
          setBlogs(data.length > 0 ? data : (DEFAULT_BLOGS as unknown as BlogPost[]));
        }
      } catch (err) {
        console.error('Failed to load blogs, using defaults:', err);
        if (!cancelled) {
          setBlogs(DEFAULT_BLOGS as unknown as BlogPost[]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = 'Resources & Blog — ACT SAT GO';
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
  };

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim()) {
      setIsSubscribed(true);
      setEmail('');
      setTimeout(() => setIsSubscribed(false), 5000);
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setActiveTopic('');
  };

  const topicPillMap: Record<string, string> = {
    'Test Prep': 'SAT Prep',
    'Study Strategies': 'Study Tips',
    'Subject Guides': 'AP Guides',
    'College Admissions': 'College Admissions',
    'Career & Future': 'Career',
    'Webinars & Videos': 'Webinars'
  };

  const handleTopicClick = (topicName: string) => {
    if (activeTopic === topicName) {
      setActiveTopic('');
      setSearchQuery('');
    } else {
      setActiveTopic(topicName);
      // Map topic to a search filter keyword to demonstrate interactivity
      const tag = topicPillMap[topicName] || '';
      setSearchQuery(tag);
    }
  };

  const handlePillClick = (pillName: string) => {
    setSearchQuery(pillName);
    // Sync active topic if applicable
    const topic = Object.keys(topicPillMap).find(key => topicPillMap[key].toLowerCase() === pillName.toLowerCase() || pillName.toLowerCase().includes(key.toLowerCase()));
    if (topic) {
      setActiveTopic(topic);
    } else {
      setActiveTopic('');
    }
  };

  // Mock Data
  const TOPICS = [
    { name: 'Test Prep', sub: 'SAT, ACT, AP, IB, GMAT', icon: <IconBook /> },
    { name: 'Study Strategies', sub: 'Tips & Techniques', icon: <IconGraduation /> },
    { name: 'Subject Guides', sub: 'Math, English & More', icon: <IconClipboard /> },
    { name: 'College Admissions', sub: 'Applications & More', icon: <IconBuilding /> },
    { name: 'Career & Future', sub: 'Explore Possibilities', icon: <IconBulb /> },
    { name: 'Webinars & Videos', sub: 'Watch & Learn', icon: <IconVideo /> },
  ];

  const FEATURED_RESOURCES = [
    {
      badge: 'PDF GUIDE',
      title: 'SAT Quick Review Guide',
      text: 'A concise guide to help you revise key concepts and formulas before the test.',
      image: satReviewImg,
      tags: ['sat', 'sat prep', 'test prep']
    },
    {
      badge: 'CHECKLIST',
      title: 'ACT Strategy Checklist',
      text: 'Step-by-step checklist to plan and ace the ACT with confidence.',
      image: actChecklistImg,
      tags: ['act', 'act strategies', 'test prep']
    },
    {
      badge: 'GUIDE',
      title: 'AP Subject Overview',
      text: 'Explore all AP subjects, exam formats, and preparation tips.',
      image: apOverviewImg,
      tags: ['ap', 'ap guides', 'test prep']
    },
    {
      badge: 'TEMPLATE',
      title: 'College Application Timeline',
      text: 'Your month-by-month roadmap for a successful college application.',
      image: collegeTimelineImg,
      tags: ['college admissions', 'template']
    }
  ];

  const DEFAULT_BLOGS = [
    {
      id: 'blog_1',
      tag: 'STUDY TIPS',
      title: '10 Proven Study Habits That Actually Work',
      text: 'Simple habits that can transform the way you study and help you retain more information for tests.',
      image: '',
      date: 'June 5, 2025',
      read: '5 min read',
      tags: ['study tips', 'study strategies']
    },
    {
      id: 'blog_2',
      tag: 'SAT',
      title: 'Digital SAT vs Paper SAT: Key Differences',
      text: 'Understand the major changes, formatting differences, and how to prepare smartly for the Digital SAT.',
      image: '',
      date: 'June 3, 2025',
      read: '6 min read',
      tags: ['sat', 'sat prep']
    },
    {
      id: 'blog_3',
      tag: 'COLLEGE ADMISSIONS',
      title: 'How to Write a Standout College Essay',
      text: 'Tips and storytelling techniques to help your unique personality and experiences shine through your admissions essay.',
      image: '',
      date: 'May 30, 2025',
      read: '7 min read',
      tags: ['college admissions', 'college essay']
    },
    {
      id: 'blog_4',
      tag: 'AP',
      title: 'Is AP Worth It? Benefits Explained',
      text: 'Everything you need to know about Advanced Placement courses, college credits, and their long-term benefits.',
      image: '',
      date: 'May 27, 2025',
      read: '4 min read',
      tags: ['ap', 'ap guides']
    }
  ];

  // Filtering Logic
  const filteredResources = FEATURED_RESOURCES.filter(res => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      res.title.toLowerCase().includes(query) ||
      res.text.toLowerCase().includes(query) ||
      res.tags.some(t => t.includes(query)) ||
      res.badge.toLowerCase().includes(query)
    );
  });

  const filteredBlogs = blogs.filter(post => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      post.title.toLowerCase().includes(query) ||
      post.text.toLowerCase().includes(query) ||
      post.tags.some(t => t.includes(query)) ||
      post.tag.toLowerCase().includes(query)
    );
  });

  const hasResults = filteredResources.length > 0 || filteredBlogs.length > 0;

  return (
    <>
      <Header />

      <main>
        {/* Hero */}
        <section className="resources-hero section-dark">
          <span className="orb orb-gold" aria-hidden="true" />
          <div className="shell">
            <p className="resources-breadcrumb">
              <a href="/#home">Home</a> <span aria-hidden="true">›</span> <span>Resources</span>
            </p>

            <div className="resources-hero-grid">
              <div className="resources-hero-copy">
                <span className="eyebrow">RESOURCES &amp; BLOG</span>
                <h1>
                  Knowledge that<br />
                  <span>Empowers Progress</span>
                </h1>
                <p className="hero-text">
                  Curated guides, expert tips, and the latest insights to help you learn smarter and achieve more.
                </p>

                {/* Search box */}
                <form className="resources-search-form" onSubmit={handleSearchSubmit}>
                  <div className="resources-search-wrapper">
                    <input
                      type="text"
                      className="resources-search-input"
                      placeholder="Search for guides, blogs, resources..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    <button type="submit" className="resources-search-btn" aria-label="Search">
                      <IconSearch />
                    </button>
                  </div>
                </form>

                {/* Popular tags */}
                <div className="resources-popular">
                  <span>Popular:</span>
                  {[
                    'SAT Prep',
                    'ACT Strategies',
                    'AP Guides',
                    'IB Guides',
                    'A Level',
                    'Study Tips'
                  ].map(pill => (
                    <button
                      key={pill}
                      type="button"
                      className={`resources-pill-btn${searchQuery.toLowerCase() === pill.toLowerCase() ? ' active' : ''}`}
                      onClick={() => handlePillClick(pill)}
                    >
                      {pill}
                    </button>
                  ))}
                </div>
              </div>

              {/* Hero Image */}
              <div className="resources-hero-art">
                <img
                  src={heroImg}
                  alt="Knowledge and education concept: Graduation cap, rocket and icons orbiting lightbulb"
                  className="resources-hero-photo"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Browse by Topic */}
        <section className="resources-section shell">
          <div className="resources-section-heading with-ornament">
            <h2>Browse by Topic</h2>
            <p>Select a category to filter resources and articles</p>
          </div>

          <div className="topics-grid">
            {TOPICS.map(topic => (
              <div
                key={topic.name}
                className={`topic-card${activeTopic === topic.name ? ' active' : ''}`}
                onClick={() => handleTopicClick(topic.name)}
              >
                <div className="topic-icon-wrapper">
                  {topic.icon}
                </div>
                <h3>{topic.name}</h3>
                <p>{topic.sub}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Empty state when search yields nothing */}
        {!hasResults && (
          <section className="shell" style={{ paddingBottom: '70px' }}>
            <div className="search-empty-state">
              <h3>No match found</h3>
              <p>We couldn't find any resources or articles matching "{searchQuery}".</p>
              <button className="clear-search-btn" onClick={clearSearch}>
                Clear Search &amp; View All
              </button>
            </div>
          </section>
        )}

        {/* Featured Resources */}
        {filteredResources.length > 0 && (
          <section className="resources-section shell" style={{ paddingTop: '0' }}>
            <div className="section-header-row">
              <div className="section-title">
                <h2>Featured Resources</h2>
                <p>High-quality guides, checklists and academic roadmaps ready to download</p>
              </div>
              <a className="view-all-link" href="#resources" onClick={(e) => { e.preventDefault(); clearSearch(); }}>
                View all resources <span aria-hidden="true">→</span>
              </a>
            </div>

            <div className="featured-grid">
              {filteredResources.map(res => (
                <div key={res.title} className="featured-card">
                  <div className="featured-image-container">
                    <span className="featured-badge">{res.badge}</span>
                    <img src={res.image} alt={`${res.title} cover`} loading="lazy" />
                    <a
                      href="#download"
                      className="featured-download-btn"
                      aria-label={`Download ${res.title}`}
                      onClick={(e) => {
                        e.preventDefault();
                        alert(`Thank you for downloading the ${res.title}! The file download will start automatically.`);
                      }}
                    >
                      <IconDownload />
                    </a>
                  </div>
                  <div className="featured-content">
                    <h3>{res.title}</h3>
                    <p>{res.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* From the Blog */}
        {filteredBlogs.length > 0 && (
          <section className="resources-section shell" style={{ paddingTop: '0' }}>
            <div className="section-header-row">
              <div className="section-title">
                <h2>From the Blog</h2>
                <p>Expert tutoring strategies, exam updates, and academic planning advice</p>
              </div>
              <a className="view-all-link" href="#blog" onClick={(e) => { e.preventDefault(); clearSearch(); }}>
                View all blogs <span aria-hidden="true">→</span>
              </a>
            </div>

            <div className="blog-grid">
              {filteredBlogs.map(post => (
                <article key={post.title} className="blog-card" onClick={() => alert(`Opening blog post: "${post.title}"`)}>
                  <div className="blog-image-wrapper">
                    <img src={getBlogImage(post)} alt={post.title} loading="lazy" />
                  </div>
                  <div className="blog-content-area">
                    <span className="blog-post-tag">{post.tag}</span>
                    <h3>{post.title}</h3>
                    <p>{post.text}</p>
                    <div className="blog-card-footer">
                      <span>{post.date}</span>
                      <span className="divider" aria-hidden="true" />
                      <span>{post.read}</span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {/* Newsletter subscription */}
        <section className="resources-newsletter shell">
          <div className="newsletter-box">
            <div className="newsletter-main-row">
              <div className="newsletter-copy">
                <h2>Stay Ahead with Expert Insights</h2>
                <p>
                  Subscribe to our newsletter and get the latest study tips, resources, and updates delivered straight to your inbox.
                </p>
              </div>
              <div className="newsletter-form-wrapper">
                {isSubscribed ? (
                  <div className="newsletter-success">
                    ✓ Thank you! You have successfully subscribed to our newsletter.
                  </div>
                ) : (
                  <form className="newsletter-form" onSubmit={handleSubscribe}>
                    <input
                      type="email"
                      className="newsletter-input"
                      placeholder="Enter your email address"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                    <button type="submit" className="newsletter-btn">
                      Subscribe
                    </button>
                  </form>
                )}
              </div>
            </div>

            <div className="newsletter-features">
              <div className="newsletter-feature-item">
                <IconSparkle />
                <span>Expert Tips</span>
              </div>
              <div className="newsletter-feature-item">
                <IconClipboard />
                <span>Latest Updates</span>
              </div>
              <div className="newsletter-feature-item">
                <IconShield />
                <span>Exclusive Resources</span>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="footer-top shell">
          {/* Brand column */}
          <div className="footer-brand-col">
            <Brand />
            <p className="footer-desc">
              ACT SAT GO offers expert guidance and resources to help students excel in their ACT | SAT | AP | and other academic courses. Join our community and unlock your potential with tailored learning strategies and comprehensive support.
            </p>
            {/* Social Media Links */}
            <div className="footer-social">
              <a href="https://www.facebook.com/actsatgousa" target="_blank" rel="noopener noreferrer" aria-label="Facebook">
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" /></svg>
              </a>
              <a href="https://www.instagram.com/act_sat_go" target="_blank" rel="noopener noreferrer" aria-label="Instagram">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="5" ry="5" /><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" /><line x1="17.5" y1="6.5" x2="17.51" y2="6.5" /></svg>
              </a>
              <a href="https://www.youtube.com/@ACTSATGOTutoring" target="_blank" rel="noopener noreferrer" aria-label="YouTube">
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46A2.78 2.78 0 0 0 1.46 6.42 29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58 2.78 2.78 0 0 0 1.95 1.96C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.96A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z" /><polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" fill="#04111f" /></svg>
              </a>
              <a href="https://www.linkedin.com/company/act-sat-go/" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn">
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" /><rect x="2" y="9" width="4" height="12" /><circle cx="4" cy="4" r="2" /></svg>
              </a>
              <a href="https://g.page/r/CaMyM5bggIx1EBM/review" target="_blank" rel="noopener noreferrer" aria-label="Google Reviews">
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
              </a>
            </div>
          </div>

          {/* Courses */}
          <div className="footer-col">
            <h4 className="footer-heading">Programs</h4>
            <ul className="footer-links">
              <li><a href="/sat">SAT</a></li>
              <li><a href="/act">ACT</a></li>
              <li><a href="/ap">AP</a></li>
              <li><a href="/k-12-tutoring">K-12 Tutoring</a></li>
              <li><a href="/future-programs">Future Programs</a></li>
            </ul>
          </div>

          {/* Quick Links */}
          <div className="footer-col">
            <h4 className="footer-heading">Company</h4>
            <ul className="footer-links">
              <li><a href="/about-us">About Us</a></li>
              <li><a href="/#programs">Our Approach</a></li>
              <li><a href="/#results">Success Stories</a></li>
              <li><a href="/consultation">Contact Us</a></li>
            </ul>
          </div>

          {/* Resources */}
          <div className="footer-col">
            <h4 className="footer-heading">Resources</h4>
            <ul className="footer-links">
              <li><a href="/resources" onClick={(e) => { e.preventDefault(); clearSearch(); }}>Blog</a></li>
              <li><a href="/resources" onClick={(e) => { e.preventDefault(); setSearchQuery('guide'); }}>Guides &amp; Downloads</a></li>
              <li><a href="/resources" onClick={(e) => { e.preventDefault(); setSearchQuery('webinar'); }}>Webinars &amp; Videos</a></li>
              <li><a href="/consultation">Help Center</a></li>
            </ul>
          </div>
        </div>

        <div className="footer-bottom shell">
          <p>&copy; {new Date().getFullYear()} ACT SAT GO. All rights reserved.</p>
          <p>Designed for students who aim higher.</p>
        </div>
      </footer>
    </>
  );
}
