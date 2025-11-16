import React from "react";

export const metadata = {
  title: "About — Path2GC",
  description: "About Path2GC and Gordon College",
};

import styles from "./about.module.css";

export default function AboutPage() {
  return (
    <main className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>About Path2GC</h1>
        <p className={styles.subtitle}>Helping students and prospective enrollees complete Gordon College admissions with a conversational AI assistant.</p>
      </header>

      <div className={styles.grid}>
        <div className={styles.left}>
          <section className={`${styles.card} mb-6`}>
            <h2 className={styles.cardTitle}>What Path2GC Does</h2>
            <p className={styles.cardText}>
              Path2GC is a web application that assists students and prospective enrollees in the
              Gordon College enrollment process through an interactive chatbot. The chatbot serves
              as the main communication channel between the student and the school, providing
              real-time guidance, answering enrollment-related queries, and helping users navigate
              each step toward successful admission.
            </p>
          </section>

          <section className={`${styles.twoCol} mb-6`}>
            <div className={styles.card}>
              <h3 className={styles.cardTitle}>About Gordon College</h3>
              <p className={styles.cardText}>Gordon College, formerly Olongapo City Colleges, is a public educational institution established in 1999 and supervised by the City Government of Olongapo.</p>
            </div>

            <div className={styles.card}>
              <h3 className={styles.cardTitle}>Contact</h3>
              <p className={styles.cardText}>📞 <a href="tel:+63472224080" className={styles.link}>(047) 222-4080</a></p>
              <p className={styles.cardText}>📧 <a href="mailto:info@gordoncollege.edu.ph" className={styles.link}>info@gordoncollege.edu.ph</a></p>
              <p className={styles.cardText}>📌 Olongapo City Sports Complex, Donor St., East Tapinac, Olongapo City 2200</p>
            </div>
          </section>

          <section className={styles.card}>
            <h3 className={styles.cardTitle}>Policies</h3>
            <div className={styles.policies}>
              <a href="#" className={styles.link}>Citizen's Charter</a>
              <a href="#" className={styles.link}>Website Policy</a>
              <a href="#" className={styles.link}>Data Privacy Policy</a>
              <a href="#" className={styles.link}>Rights of the Data Subjects</a>
              <a href="#" className={styles.link}>Responsibilities of the Data Subjects</a>
            </div>
          </section>
        </div>

        <aside className={styles.aside}>
          <div className={styles.card}>
            <h3 className={styles.cardTitle}>Student Resources</h3>
            <ul className={styles.resourceList}>
              <li><a href="https://gordoncollegeccs.edu.ph/ccs/students/lamp/#/login" target="_blank" rel="noopener noreferrer" className={styles.link}>GC-Lamp</a></li>
              <li><a href="https://gordoncollegeccs.edu.ph/gces/student/#/login" target="_blank" rel="noopener noreferrer" className={styles.link}>GC-Student Portal</a></li>
              <li><a href="https://gordoncollege.edu.ph/gca/student#/login" target="_blank" rel="noopener noreferrer" className={styles.link}>GC-Admission</a></li>
            </ul>
          </div>

          <div className={styles.card}>
            <h3 className={styles.cardTitle}>Faculty Resources</h3>
            <ul className={styles.resourceList}>
              <li><a href="https://gordoncollegeccs.edu.ph/ccs/students/lamp/#/login" target="_blank" rel="noopener noreferrer" className={styles.link}>GC-Lamp</a></li>
              <li><a href="https://gordoncollegeccs.edu.ph/ccs/healthcheck/personnel/#/login" target="_blank" rel="noopener noreferrer" className={styles.link}>GC-Health Check</a></li>
              <li><a href="https://gordoncollegeccs.edu.ph/gces/evaluator/#/login" target="_blank" rel="noopener noreferrer" className={styles.link}>GCES Evaluator's Portal</a></li>
              <li><a href="https://gordoncollegeccs.edu.ph/gca/evaluator/#/login" target="_blank" rel="noopener noreferrer" className={styles.link}>GCA Evaluator's Portal</a></li>
              <li><a href="https://gordoncollegeccs.edu.ph/gca/dean/#/login" target="_blank" rel="noopener noreferrer" className={styles.link}>GCA Dean's Portal</a></li>
            </ul>
          </div>
        </aside>
      </div>
    </main>
  );
}
