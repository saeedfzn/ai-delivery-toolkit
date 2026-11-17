Need: applicants want to know their documents have arrived, so they don't have to phone to ask. User type: **applicant**.

I've split this into two stories because there are two outcomes: being told at the moment documents arrive, and checking later. One story would also go over 6 criteria.

---

**Story: Confirm to applicants that documents were received**

As an applicant, I want to be told when my documents have been received, so that I know they arrived and I don't need to phone to check.

**Acceptance criteria**
1. Given I have uploaded one or more documents, when the upload finishes, then I see a confirmation page listing each document received by file name and the date received.
2. Given I have uploaded documents, when the upload finishes, then I am sent a confirmation message listing the documents received, to the contact method on my application.
3. Given one of my files fails to upload (for example, wrong file type or too large), when I submit, then I see an error summary naming the file and the reason, and that file is not shown as received.
4. Given the upload does not finish (for example, a timeout), when I return to the page, then I see that the documents were not received and how to try again. I do not see a confirmation.
5. Given I use a keyboard or screen reader, when the confirmation or error summary appears, then focus moves to it, it is read out, and every link and button can be reached and used by keyboard.

**Notes**
- Out of scope: telling applicants whether their documents are acceptable or have been checked (see open questions).
- Dependencies: the service that sends messages (email/SMS) – owner TBC.
- Key / points / owner: TBC

---

**Story: Check which documents we have received**

As an applicant, I want to see which of my documents have been received, so that I can check later without phoning and know if anything is still missing.

**Acceptance criteria**
1. Given I am signed in to my application, when I open the documents section, then I see each document received with the date it was received.
2. Given documents are still needed for my application, when I open the documents section, then each outstanding document is shown as "Not yet received".
3. Given no documents have been received yet, when I open the documents section, then I see "We have not received any documents yet" and how to send them.
4. Given the document information cannot be loaded, when I open the documents section, then I see a message saying the information is not available right now and to try again later. I do not see an empty list that suggests nothing was received.
5. Given I use a keyboard or screen reader, when I move through the documents section, then each status is read out with its document name, and all controls can be reached by keyboard with visible focus.

**Notes**
- Out of scope: uploading or replacing documents from this page.
- Dependencies: a reliable record of which documents are expected for each application – owner TBC.
- Key / points / owner: TBC

---

## Open questions

1. How do applicants send documents today? Online upload only, or also by post or email? Posted documents would need to be logged by staff before they can show as received, which may need a story for caseworkers.
2. Does "received" mean only "arrived", or should applicants also see "checked" or "accepted"? Applicants may phone about that next.
3. Which contact method should confirmations use (email, SMS, letter)? Is there a policy on what can be put in a message?
4. Do applicants already have a sign-in or account? Story 2 depends on it.
5. Is a list of required documents per application available, so that "Not yet received" can be shown?
6. Must this be available in Welsh?
7. Is there a time limit after which we should tell applicants that a document is overdue?

## Assumptions

- Assumption: applicants can upload documents online (story 1, criteria 1, 3, 4).
- Assumption: we hold a contact method for each applicant (story 1, criterion 2).

No personal data was in the request, so nothing needed to be removed.

If you want these in Jira, I can prepare each story for the `draft_ticket` tool once it's connected. That produces drafts for someone to approve; it doesn't create tickets.
