import { useState } from 'react';
import { Link } from 'react-router-dom';
import BookingForm from '../components/BookingForm';
import { Brand } from '../components/StaffLayout';
import { hhmm, longDate } from '../lib';

export default function Book() {
  const [booked, setBooked] = useState(null);
  const [formKey, setFormKey] = useState(0);

  return (
    <div className="public">
      <header className="public-header">
        <Brand />
        <Link to="/staff" className="muted">Staff login</Link>
      </header>
      <main className="public-main">
        <section className="intro">
          <h1>Book an appointment</h1>
          <p>Choose a service, a doctor and a free time. We will call you to confirm your visit.</p>
        </section>

        {booked ? (
          <div className="card confirmation" role="status">
            <div className="tick" aria-hidden="true">✓</div>
            <h2>Booking received</h2>
            <p className="ref">Reference <strong>{booked.ref_no}</strong></p>
            <p>
              {booked.doctor}, {longDate(booked.appt_date)} at {hhmm(booked.start_time)}
            </p>
            <p className="muted">
              Keep your reference number. The clinic will call you to confirm. Please arrive
              10 minutes early.
            </p>
            <button className="btn primary" onClick={() => { setBooked(null); setFormKey((k) => k + 1); }}>
              Book another appointment
            </button>
          </div>
        ) : (
          <div className="card">
            <BookingForm key={formKey} onBooked={setBooked} />
          </div>
        )}
      </main>
      <footer className="public-footer muted">Kairuki Clinic · Dar es Salaam</footer>
    </div>
  );
}
