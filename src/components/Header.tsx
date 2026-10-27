
import { Link, NavLink } from "react-router-dom";

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
          aria-label="Economic Policy Lab home"
        >
          <img
            className="brand-logo"
            src="/epl-logo.jpg"
            alt="Economic Policy Lab logo"
          />

          <span className="brand-name">
            <span className="brand-letter-e">E</span>
            <span className="brand-letter-p">P</span>
            <span className="brand-letter-l">L</span>
            <span className="brand-rest">
              {" "}Economic Policy Lab
            </span>
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
