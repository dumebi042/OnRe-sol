/**
 * P2: Token-2022 Transfer Fee Vulnerability in Redemption Path
 * DYNAMIC PoC
 *
 * This test demonstrates the vulnerability at runtime on the patched binary.
 * The only change from the deployed program is boxing of MakeOffer accounts
 * (stack overflow fix) - NO redemption logic was modified.
 *
 * Steps:
 * 1. Create a Token-2022 mint with 1% transfer fee
 * 2. Set up an offer + redemption offer
 * 3. Create a redemption request
 * 4. Show accounting mismatch (vault received `amount - fee` but request records `amount`)
 * 5. Attempt cancel -> FAILS (vault insufficient)
 * 6. Attempt fulfill -> FAILS (vault insufficient)
 */
import { Keypair, PublicKey, Transaction } from "@solana/web3.js";
import { TestHelper } from "../test_helper";
import { OnreProgram } from "../onre_program.ts";
import { getAssociatedTokenAddressSync, TOKEN_2022_PROGRAM_ID, createAssociatedTokenAccountInstruction, createMintToInstruction } from "@solana/spl-token";

describe("P2: Token-2022 Transfer Fee Dynamic PoC", () => {
    let testHelper: TestHelper;
    let program: OnreProgram;

    let usdcMint: PublicKey;
    let onycMintWithFee: PublicKey;
    let offerPda: PublicKey;
    let redemptionOfferPda: PublicKey;
    let redemptionAdmin: Keypair;
    let redeemer: Keypair;

    // Fee parameters
    const TRANSFER_FEE_BPS = 100; // 1% = 100 basis points
    const TRANSFER_FEE_MAX = 1_000_000; // max fee
    const REDEMPTION_FEE_BPS = 500; // 5%
    const AMOUNT = 1_000_000_000n; // 1 ONyc (9 decimals)

    // Token-2022 transfer fee: min(1_000_000_000 * 1%, 1_000_000) = 1_000_000
    const EXPECTED_FEE = 1_000_000n;
    // Vault actually receives: AMOUNT - fee
    const VAULT_RECEIVES = AMOUNT - EXPECTED_FEE; // 999_000_000

    beforeAll(async () => {
        testHelper = await TestHelper.create();
        program = new OnreProgram(testHelper);

        // ── 1. Create mints ────────────────────────────────────────────
        usdcMint = testHelper.createMint(6); // USDC (no fee)

        // Token-2022 mint with 1% transfer fee
        onycMintWithFee = await testHelper.createMint2022WithTransferFee(9, TRANSFER_FEE_BPS, BigInt(TRANSFER_FEE_MAX), null, null);

        // ── 2. Initialize program ──────────────────────────────────────
        await program.initialize({ onycMint: onycMintWithFee });

        redemptionAdmin = testHelper.createUserAccount();
        await program.setRedemptionAdmin({ redemptionAdmin: redemptionAdmin.publicKey });

        redeemer = testHelper.createUserAccount();

        // ── 3. Fund redeemer with Token-2022 ONyc ──────────────────────
        // createMint2022WithTransferFee created boss ATA + minted to boss.
        // Create redeemer ATA and mint to redeemer directly.
        const redeemerTokenAccount = getAssociatedTokenAddressSync(onycMintWithFee, redeemer.publicKey, false, TOKEN_2022_PROGRAM_ID);

        const createAtaIx = createAssociatedTokenAccountInstruction(testHelper.payer.publicKey, redeemerTokenAccount, redeemer.publicKey, onycMintWithFee, TOKEN_2022_PROGRAM_ID);
        const ataTx = new Transaction().add(createAtaIx);
        await testHelper.sendAndConfirmTransaction(ataTx, [testHelper.payer]);

        // Mint 10 ONyc to redeemer (boss still has mint authority)
        const mintIx = createMintToInstruction(onycMintWithFee, redeemerTokenAccount, testHelper.getBoss(), BigInt(10_000_000_000), [], TOKEN_2022_PROGRAM_ID);
        const mintTx = new Transaction().add(mintIx);
        await testHelper.sendAndConfirmTransaction(mintTx, [testHelper.payer]);

        // ── 4. Create offer infrastructure ─────────────────────────────
        await program.makeOffer({
            tokenInMint: usdcMint,
            tokenOutMint: onycMintWithFee,
        });
        offerPda = program.getOfferPda(usdcMint, onycMintWithFee);

        // Add pricing vector
        const currentTime = await testHelper.getCurrentClockTime();
        await program.addOfferVector({
            tokenInMint: usdcMint,
            tokenOutMint: onycMintWithFee,
            baseTime: currentTime,
            basePrice: 1e9,
            apr: 0,
            priceFixDuration: 86400,
        });

        // Create redemption offer
        await program.makeRedemptionOffer({
            offer: offerPda,
            feeBasisPoints: REDEMPTION_FEE_BPS,
            tokenInProgram: TOKEN_2022_PROGRAM_ID,
        });
        redemptionOfferPda = program.getRedemptionOfferPda(onycMintWithFee, usdcMint);

        // ── 5. Create ATAs for vault and boss ──────────────────────────
        // Vault ATA for Token-2022 (PDA owner)
        await testHelper.createToken2022Account(onycMintWithFee, program.pdas.redemptionVaultAuthorityPda);
        // Boss ATA for Token-2022
        await testHelper.createToken2022Account(onycMintWithFee, testHelper.getBoss());
        // Boss USDC account (funded, for vault deposit)
        testHelper.createTokenAccount(usdcMint, testHelper.getBoss(), BigInt(1_000_000_000)); // 1000 USDC

        // ── 6. Deposit USDC into redemption vault ──────────────────────
        // Needed for fulfill path (token_out = USDC)
        await program.redemptionVaultDeposit({
            amount: 1_000_000, // 1 USDC
            tokenMint: usdcMint,
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    //  TEST 1: Accounting mismatch
    // ═══════════════════════════════════════════════════════════════════
    test("TEST 1: Vault receives AMOUNT - FEE (not full AMOUNT)", async () => {
        const vaultTokenAccountAddr = getAssociatedTokenAddressSync(onycMintWithFee, program.pdas.redemptionVaultAuthorityPda, true, TOKEN_2022_PROGRAM_ID);
        const vaultBefore = await testHelper.getTokenAccountBalance(vaultTokenAccountAddr);

        // Create redemption request
        await program.createRedemptionRequest({
            redemptionOffer: redemptionOfferPda,
            redeemer,
            amount: Number(AMOUNT),
            tokenProgram: TOKEN_2022_PROGRAM_ID,
        });

        const vaultAfter = await testHelper.getTokenAccountBalance(vaultTokenAccountAddr);
        const vaultIncrease = vaultAfter - vaultBefore;

        console.log(`\n  Amount requested:   ${AMOUNT}`);
        console.log(`  Token-2022 fee:     ${EXPECTED_FEE}`);
        console.log(`  Vault received:     ${vaultIncrease}`);
        console.log(`  Expected received:  ${VAULT_RECEIVES}`);

        expect(vaultIncrease).toBeLessThan(AMOUNT);
        expect(vaultIncrease).toBe(VAULT_RECEIVES);
    });

    // ═══════════════════════════════════════════════════════════════════
    //  TEST 2: Request records full amount
    // ═══════════════════════════════════════════════════════════════════
    test("TEST 2: RedemptionRequest.amount == AMOUNT (mismatch with vault)", async () => {
        const redReq = await program.getRedemptionRequest(redemptionOfferPda, 0);
        const recordedAmount = BigInt(redReq.amount.toString());

        const vaultTokenAccountAddr = getAssociatedTokenAddressSync(onycMintWithFee, program.pdas.redemptionVaultAuthorityPda, true, TOKEN_2022_PROGRAM_ID);
        const vaultBalance = await testHelper.getTokenAccountBalance(vaultTokenAccountAddr);

        console.log(`\n  Request recorded:  ${recordedAmount}`);
        console.log(`  Vault has:         ${vaultBalance}`);
        console.log(`  Shortfall:         ${recordedAmount - vaultBalance}`);

        // The recorded amount equals the FULL requested amount
        expect(recordedAmount).toBe(AMOUNT);
        // But vault has LESS
        expect(vaultBalance).toBeLessThan(recordedAmount);
        expect(vaultBalance).toBe(VAULT_RECEIVES);
    });

    // ═══════════════════════════════════════════════════════════════════
    //  TEST 3: Cancel fails
    // ═══════════════════════════════════════════════════════════════════
    test("TEST 3: Cancel fails - vault cannot return recorded amount", async () => {
        const reqPda = program.getRedemptionRequestPda(redemptionOfferPda, 0);

        await expect(
            program.cancelRedemptionRequest({
                redemptionOffer: redemptionOfferPda,
                redemptionRequest: reqPda,
                signer: redeemer,
                redemptionAdmin: redemptionAdmin.publicKey,
                tokenProgram: TOKEN_2022_PROGRAM_ID,
            }),
        ).rejects.toThrow();

        // Vault unchanged
        const vaultAddr = getAssociatedTokenAddressSync(onycMintWithFee, program.pdas.redemptionVaultAuthorityPda, true, TOKEN_2022_PROGRAM_ID);
        expect(await testHelper.getTokenAccountBalance(vaultAddr)).toBe(VAULT_RECEIVES);
    });

    // ═══════════════════════════════════════════════════════════════════
    //  TEST 4: Fulfill fails
    // ═══════════════════════════════════════════════════════════════════
    test("TEST 4: Fulfill fails - vault cannot satisfy recorded amount", async () => {
        const reqPda = program.getRedemptionRequestPda(redemptionOfferPda, 0);

        await expect(
            program.fulfillRedemptionRequest({
                offer: offerPda,
                redemptionOffer: redemptionOfferPda,
                redemptionRequest: reqPda,
                redeemer: redeemer.publicKey,
                redemptionAdmin,
                tokenInMint: onycMintWithFee,
                tokenOutMint: usdcMint,
                tokenInProgram: TOKEN_2022_PROGRAM_ID,
            }),
        ).rejects.toThrow();

        // Vault unchanged
        const vaultAddr = getAssociatedTokenAddressSync(onycMintWithFee, program.pdas.redemptionVaultAuthorityPda, true, TOKEN_2022_PROGRAM_ID);
        expect(await testHelper.getTokenAccountBalance(vaultAddr)).toBe(VAULT_RECEIVES);
    });

    // ═══════════════════════════════════════════════════════════════════
    //  TEST 5: Request is stuck
    // ═══════════════════════════════════════════════════════════════════
    test("TEST 5: RedemptionRequest remains unresolved (stuck)", async () => {
        const redReq = await program.getRedemptionRequest(redemptionOfferPda, 0);
        expect(redReq.amount.toString()).toBe(AMOUNT.toString());

        const redOffer = await program.getRedemptionOffer(onycMintWithFee, usdcMint);
        console.log(`\n  Requested redemptions: ${redOffer.requestedRedemptions.toString()}`);
        console.log(`  Vault balance:         ${VAULT_RECEIVES}`);
        console.log(`  Tokens are STUCK - cancel and fulfill both fail`);
        console.log(`  Recovery: boss deposits ${EXPECTED_FEE} via redemption_vault_deposit`);
    });
});
