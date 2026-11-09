/**
 * What editing a group does to its people. Editing used to rebuild the member list from scratch
 * (members: only the editor, pendingInvites: everyone selected) without sending invitations, so
 * saving an edit silently removed every other member. The rules now are:
 * - the editor stays a member;
 * - a current member stays a member while they are still ticked in the form;
 * - a pending invitation stays pending while the person is still ticked;
 * - anyone ticked who is neither a member nor already invited is a new invitee (and gets a real
 *   invitation).
 */

export interface GroupEditPlan {
  members: string[];
  pendingInvites: string[];
  newInvitees: string[];
}

export const planGroupEdit = (
  previousMembers: readonly string[],
  previousPending: readonly string[],
  selectedEmails: readonly string[],
  editorEmail: string,
): GroupEditPlan => {
  const selected = new Set(selectedEmails);
  const members = previousMembers.filter(
    email => email === editorEmail || selected.has(email),
  );
  if (editorEmail && !members.includes(editorEmail)) {
    members.unshift(editorEmail);
  }
  const pendingInvites = previousPending.filter(email => selected.has(email));
  const newInvitees = selectedEmails.filter(
    (email, index) =>
      selectedEmails.indexOf(email) === index &&
      !previousMembers.includes(email) &&
      !previousPending.includes(email) &&
      email !== editorEmail,
  );
  return {
    members,
    pendingInvites: [...pendingInvites, ...newInvitees],
    newInvitees,
  };
};
