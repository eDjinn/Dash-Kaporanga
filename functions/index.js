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
      "É necessário fornecer o e-mail do usuário e o caminho do documento."
    );
  }

  const db = admin.firestore();
  const docRef = db.doc(docPath);
  const callerUid = context.auth.uid;

  try {
    // 2. Busca o UID do usuário pelo e-mail fornecido.
    const targetUser = await admin.auth().getUserByEmail(targetEmail);
    const targetUid = targetUser.uid;

    const docSnap = await docRef.get();

    // 3. Se o documento NÃO EXISTIR, crie-o com o chamador e o alvo na lista.
    if (!docSnap.exists) {
      await docRef.set({
        allowedUsers: [callerUid, targetUid]
      });
      return { result: `Documento criado e usuário ${targetEmail} convidado com sucesso.` };
    }

    // 4. Se o documento EXISTIR, verifique se o chamador tem permissão.
    const docData = docSnap.data();
    if (!docData.allowedUsers || !docData.allowedUsers.includes(callerUid)) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Você não tem permissão para convidar usuários para este documento."
      );
    }

    // 5. Adiciona o UID do novo usuário ao array, sem duplicatas.
    await docRef.update({
      allowedUsers: admin.firestore.FieldValue.arrayUnion(targetUid),
    });

    return { result: `Usuário ${targetEmail} convidado com sucesso.` };

  } catch (error) {
    if (error.code === "auth/user-not-found") {
      throw new functions.https.HttpsError("not-found", `O usuário com o e-mail ${targetEmail} não foi encontrado.`);
    }
    console.error("Erro na Cloud Function:", error);
    throw new functions.https.HttpsError("internal", "Ocorreu um erro interno ao processar sua solicitação.");
  }
});