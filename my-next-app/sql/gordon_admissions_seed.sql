-- SQL seed for Gordon College admissions pages.
-- Review before running in your SQL editor. This file inserts into `faqs` and `admission_steps`.

BEGIN;

-- FAQs
INSERT INTO faqs (question, answer)
VALUES
  ('Freshmen Students — Admission Requirements', 'Admission to Gordon College shall be open to Filipino citizens, both residents and non-residents of Olongapo City, Non-Filipino citizens, high school graduates, or passers of the high school equivalency certificate (PEPT). A NON-RESIDENT is defined as any individual who has lived less than one year in Olongapo City, is not registered to vote in Olongapo City and/or does not pay property taxes or contributes to the economic development of Olongapo City.'),
  ('Freshmen Students — New College Freshmen Students for Undergraduate Programs', 'Admission to the chosen degree program will be based on an applicant’s Gordon College Admission Test (GCAT) results and previous high school/college academic records. Typical requirements: Original copy of High School Report Card (F138/SF9) or Original ALS Certificate of Rating Secondary Level for ALS Passers; Certificate of Good Moral Character; Copy of Birth Certificate; Medical Certificate (Issued by the Gordon College Clinic); Barangay Certificate of Residency; One 2x2 picture.'),
  ('Continuing Students, Returnees and Cross Enrollment — Continuing Students and Returnees', 'Continuing students are those previously enrolled but unable to enroll for at least one semester who decide to continue. Returning students requested transfer credentials but decide to re-enroll; returning students shall no longer be required to take the admission test.'),
  ('Continuing Students, Returnees and Cross Enrollment — Cross Enrollment', 'GC students must get consultation and consent from College Deans; cross-enroll not allowed if subject/course is not open during last two semesters; request recommendation from Dean and authorization from Registrar. Students from other schools must present written permission from their school.'),
  ('IGS Students — Admission Standards', 'Applicants must meet general and specific standards. Minimum undergraduate GPA of 2.00 or 85%. Students with lower averages may be admitted on probation. Specific programs may require additional materials, experience, or interviews.'),
  ('IGS Students — Requirements and Procedures', 'Applicants must pass qualifying examination and interview. Applicants must submit Original Transcript of Records; two ID pictures (2x2); Certificate of Employment (where applicable); Php200 non-refundable application processing fee; additional materials if required by program.'),
  ('Transferees and Second Courser — Required Documents', 'Transfer Credential; Certificate of Good Moral Character; Copy of Birth Certificate; Medical Certificate (Issued by the Gordon College Clinic); Barangay Certificate of Residency; One 2x2 picture');

-- Admission steps (conservative inserts; step_order left NULL where unknown)
INSERT INTO admission_steps (step_order, title, description)
VALUES
  (1, 'Admission Requirements', 'Admission to Gordon College shall be open to Filipino citizens, both residents and non-residents of Olongapo City, Non-Filipino citizens, high school graduates, or passers of the high school equivalency certificate (PEPT).'),
  (2, 'New College Freshmen Students for Undergraduate Programs', 'Admission to the chosen degree program will be based on GCAT results and previous academic records. Required documents include High School Report Card, Certificate of Good Moral Character, Birth Certificate, Medical Certificate, Barangay Certificate of Residency, and one 2x2 picture.'),
  (3, 'Continuing Students and Returnees', 'Continuing students are those previously enrolled but unable to enroll for at least one semester who decide to continue. Returning students requested transfer credentials but decide to re-enroll and shall no longer be required to take the admission test.'),
  (4, 'Cross Enrollment', 'Details about cross enrollment: consultations and approvals required from Deans and Registrar; visiting students must provide permission from their home institution.'),
  (5, 'IGS Admission Standards', 'Graduate applicants must have minimum undergraduate GPA of 2.00 or 85% (program-specific exceptions apply). Some programs require work experience or program-specific requirements.'),
  (6, 'Transferees and Second Courser Requirements', 'Transfer credential, Certificate of Good Moral Character, Birth Certificate, Medical Certificate, Barangay Certificate of Residency, and one 2x2 picture.');

COMMIT;

-- NOTE: Adapt columns if your schema differs (for example if your `faqs` table has additional
-- columns like `source_url` or timestamps with NOT NULL constraints). Run in a safe transaction.
