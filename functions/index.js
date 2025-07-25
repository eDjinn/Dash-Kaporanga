const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

exports.inviteUserToDocument = functions.https.onCall(async (data, context) => {
  // 1. Verifica se o usuário que está fazendo a chamada está autenticado.
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Você precisa estar logado para convidar usuários."
    );
  }

  const { targetEmail, docPath } = data;
  if (!targetEmail || !docPath) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "É necessário fornecer o e-mail e o caminho do documento."
    );
  }

  const db = admin.firestore();
  const docRef = db.doc(docPath);
  const callerUid = context.auth.uid;

  // 2. Verifica se o chamador tem permissão para convidar (se ele já está na lista).
  const docSnap = await docRef.get();
  if (!docSnap.exists || !docSnap.data().allowedUsers.includes(callerUid)) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Você não tem permissão para convidar usuários para este documento."
    );
  }

  try {
    // 3. Busca o UID do usuário pelo e-mail fornecido.
    const targetUser = await admin.auth().getUserByEmail(targetEmail);
    const targetUid = targetUser.uid;

    // 4. Adiciona o UID do novo usuário ao array, sem duplicatas.
    await docRef.update({
      allowedUsers: admin.firestore.FieldValue.arrayUnion(targetUid),
    });

    return { result: `Usuário ${targetEmail} convidado com sucesso.` };
  } catch (error) {
    // Trata o erro se o e-mail não for encontrado.
    if (error.code === "auth/user-not-found") {
      throw new functions.https.HttpsError("not-found", `O usuário com o e-mail ${targetEmail} não foi encontrado.`);
    }
    throw new functions.https.HttpsError("internal", "Ocorreu um erro ao processar sua solicitação.");
  }
});