import { Link, NavLink } from "react-router-dom";

const wordmarkStyle = {
  display: "inline-block",
  fontFamily: "Arial, Helvetica, sans-serif",
  fontWeight: 900,
  fontStyle: "italic" as const,
  letterSpacing: "-0.02em",
  transform: "skewX(-12deg)",
  transformOrigin: "left center",
};

export default function Header() {
  
const navigation = [
  { to: "/", label: "Home" },
  { to: "/events", label: "Events" },
  { to: "/articles", label: "Articles" },
  { to: "/research", label: "Research" },
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
            <span className="brand-letter-e">E</span>
            <span className="brand-rest">conomic </span>
            {" "}
            <span className="brand-letter-p">P</span>
            <span className="brand-rest">olicy</span>
            {" "}
            <span className="brand-letter-l">L</span>
            <span className="brand-rest">abs</span>
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
