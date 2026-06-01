// ══════════════════════════════════════════════════════════════
// ADD THIS TO YOUR admin.jsx
// ══════════════════════════════════════════════════════════════
//
// 1. Add 'suggestions' to the NAV array:
//
//   { id: 'suggestions', label: 'Suggestions', icon: 'lightbulb' },
//
// 2. Add the icon to Icons:
//
//   lightbulb: <Ic d={<><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></>}/>,
//   star:      <Ic d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>,
//
// 3. Add to TITLES in AdminDashboard:
//
//   suggestions: { title: 'User Suggestions', subtitle: 'Feedback submitted by buyers and sellers' },
//
// 4. Add the render block inside <div className="content">:
//
//   {active === 'suggestions' && <ViewSuggestions />}
//
// 5. Paste the component below into admin.jsx:
// ══════════════════════════════════════════════════════════════

