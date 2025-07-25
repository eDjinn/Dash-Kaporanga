const admin = require("firebase-admin");
const { onCall, HttpsError } = require("firebase-functions/v2/https");

admin.initializeApp();

// Esta é a nova sintaxe para exportar uma função de 2ª Geração.
exports.inviteUserToDocument = onCall(
  // Opções da função, como a região.
  { region: "us-central1" },

  // A função principal, que agora recebe um objeto 'request'.
  async (request) => {
    
    // 1. A verificação de autenticação agora usa 'request.auth'.
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "Você precisa estar logado para convidar usuários."
      );
    }

    // 2. Os dados da chamada agora vêm de 'request.data'.
    const { targetEmail, docPath } = request.data;
    if (!targetEmail || !docPath) {
      throw new HttpsError(
        "invalid-argument",
        "É necessário fornecer o e-mail do usuário e o caminho do documento."
      );
    }

    const db = admin.firestore();
    const docRef = db.doc(docPath);
    // 3. O UID do chamador vem de 'request.auth.uid'.
    const callerUid = request.auth.uid;

    try {
      const docSnap = await docRef.get();

      if (!docSnap.exists) {
        throw new HttpsError("not-found", "O documento de destino não existe.");
      }

      const docData = docSnap.data();
      if (!docData.allowedUsers || !docData.allowedUsers.includes(callerUid)) {
        throw new HttpsError(
          "permission-denied",
          "Você não tem permissão para convidar usuários para este documento."
        );
      }
      
      const targetUser = await admin.auth().getUserByEmail(targetEmail);
      const targetUid = targetUser.uid;

      if (docData.allowedUsers.includes(targetUid)) {
          return { result: `O usuário ${targetEmail} já tem acesso.` };
      }

      await docRef.update({
        allowedUsers: admin.firestore.FieldValue.arrayUnion(targetUid),
      });

      return { result: `Usuário ${targetEmail} convidado com sucesso!` };

    } catch (error) {
      if (error.code === "auth/user-not-found") {
        throw new HttpsError("not-found", `O usuário com o e-mail ${targetEmail} não foi encontrado.`);
      }
      console.error("Erro na Cloud Function inviteUserToDocument:", error);
      throw new HttpsError("internal", "Ocorreu um erro interno ao processar sua solicitação.");
    }
  }
);