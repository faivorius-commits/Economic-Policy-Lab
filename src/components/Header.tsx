
import { Link, NavLink } from "react-router-dom";

const wordmarkStyle = {
  fontFamily: "Arial, sans-serif",
  fontWeight: 900,
  fontStyle: "italic" as const,
  letterSpacing: "-0.035em",
};

export default function Header() {
  const navigation = [
    { to: "/", label: "Home" },
    { to: "/research", label: "Research" },
    { to: "/articles", label: "Articles" },
    { to: "/team", label: "Team" },
    { to: "/join", label: "Join Us" },
  ];

  return (
    <header className="site-header">
      <div className="header-inner">
        <Link
          to="/"
          className="brand"
          aria-label="Economic Policy Labs home"
        >
          <img
            className="brand-logo"
            src="/epl-logo.jpg"
            alt="Economic Policy Labs logo"
          />

          <span className="brand-name" style={wordmarkStyle}>
            <span className="brand-letter-e" style={wordmarkStyle}>E</span>
            <span className="brand-rest" style={wordmarkStyle}>conomic </span>
            <span className="brand-letter-p" style={wordmarkStyle}>P</span>
            <span className="brand-rest" style={wordmarkStyle}>olicy </span>
            <span className="brand-letter-l" style={wordmarkStyle}>L</span>
            <span className="brand-rest" style={wordmarkStyle}>abs</span>
          </span>
        </Link>

        <Link to="/login" className="login-link">
          Log in
        </Link>
      </div>

      <nav className="main-nav" aria-label="Main navigation">
        {navigation.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </header>
  );
}
