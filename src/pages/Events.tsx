
import { useState } from "react";
import "./Events.css";

const event = {
  title: "Visit to the Indonesia Stock Exchange (BEI)",
  year: "2025",
  date: "Early 2025",
  location: "Indonesia Stock Exchange (BEI), Jakarta",
  description:
    "A visit to the Indonesia Stock Exchange (BEI) in early 2025, offering an opportunity to explore the capital market environment and meet one of BEI's directors.",
  cover: "/images/events/event1-doc1.jpg",
  documents: [
    "/images/events/event1-doc1.jpg",
    "/images/events/event1-doc2.jpg",
    "/images/events/event1-doc3.jpg",
    "/images/events/event1-doc4.jpg",
    "/images/events/event1-doc5.jpg",
  ],
};

export default function Events() {
  const [selectedEvent, setSelectedEvent] = useState(false);

  return (
    <main className="events-page">
      {!selectedEvent ? (
        <>
          <section className="events-heading">
            <span className="events-eyebrow">ECONOMIC POLICY LAB</span>
            <h1>Events</h1>
            <p>
              Explore our events, visits, discussions, and activities
              through moments of learning and collaboration.
            </p>
          </section>

          <section className="events-list">
            <button
              className="event-card"
              onClick={() => setSelectedEvent(true)}
            >
              <div className="event-cover">
                <img src={event.cover} alt="Visit to BEI" />
                <span className="event-year">{event.year}</span>
              </div>

              <div className="event-meta">
                <span>{event.date}</span>
                <span>{event.location}</span>
              </div>
            </button>
          </section>
        </>
      ) : (
        <section className="event-detail">
          <button
            className="event-back"
            onClick={() => setSelectedEvent(false)}
          >
            ← Back to Events
          </button>

          <span className="events-eyebrow">
            {event.year} · EVENT DOCUMENTATION
          </span>

          <h1>{event.title}</h1>

          <div className="event-information">
            <span>{event.date}</span>
            <span>{event.location}</span>
          </div>

          <p className="event-description">
            {event.description}
          </p>

          <div className="event-gallery">
            {event.documents.map((image, index) => (
              <img
                key={image}
                src={image}
                alt={`Event documentation ${index + 1}`}
                loading="lazy"
              />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
