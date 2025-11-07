-- Seed a few example admission steps and FAQs

insert into admission_steps (step_order, title, description, checklist, related_resources)
values
(1, 'Prepare Requirements', 'Gather the necessary documents you will need for application and enrollment. Typical documents include birth certificate, high school transcript, report of grades, good moral certificate, 2x2 ID photos, and a valid government ID. Make certified true copies where required.',
  '[{"item":"Birth certificate (original + copy)"},{"item":"High School Transcript of Records"},{"item":"Good Moral Certificate"},{"item":"2x2 ID photos (2-4 pcs)"}]'::jsonb,
  '[{"title":"Application form (PDF)","url":"/public/forms/application.pdf"}]'::jsonb),
(2, 'Online Application', 'Access the online application portal, create an account, and complete the form. Upload scanned copies of your documents and submit. Keep a copy of your confirmation email and application number for reference.',
  '[{"item":"Create account on portal"},{"item":"Complete form fields"},{"item":"Upload scanned documents"}]'::jsonb,
  '[{"title":"Online application portal","url":"https://example.edu/apply"}]'::jsonb),
(3, 'Entrance Exam / Interview', 'After submission, check the admissions schedule for exam dates or interview slots. Prepare by reviewing sample questions or bringing required IDs for verification. Some programs may waive exams based on grades.',
  '[{"item":"Check exam schedule"},{"item":"Bring valid ID"},{"item":"Review sample questions"}]'::jsonb,
  '[]'::jsonb),
(4, 'Submission and Payment', 'Pay application or processing fees (if applicable) and submit payment receipts. Follow the payment instructions on the admissions portal or bank payment slip.',
  '[{"item":"Pay application fee (if required)"},{"item":"Upload payment receipt"}]'::jsonb,
  '[]'::jsonb),
(5, 'Acceptance and Enrollment', 'If accepted, follow the enrollment instructions: confirm your slot, attend orientation, and complete enrollment steps including assessment and subject pre-registration.',
  '[{"item":"Confirm acceptance"},{"item":"Attend orientation"},{"item":"Complete enrollment"}]'::jsonb,
  '[]'::jsonb);

insert into faqs (question, answer, topic) values
('How do I apply as a freshman?', 'Start by preparing requirements, then complete the online application, submit documents, and follow instructions for exams or interviews.', 'application'),
('What documents are required?', 'Typical documents: birth certificate, high school transcript, good moral certificate, 2x2 photos, and ID. Some programs may require additional documents; check the specific program page.', 'documents'),
('Is there an application fee?', 'Some programs require a non-refundable application fee. Check the admissions portal or contact the Admissions Office for fee details and payment methods.', 'fees');
