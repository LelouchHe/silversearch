<script lang="ts">
    import ModalFile from "./ModalFile.svelte";
    import ModalSpace from "./ModalSpace.svelte";

    const {
        defaultQuery,
        currentPath,
        isDocumentEditor,
        customStyles
    }: {
        defaultQuery: string;
        currentPath: string;
        isDocumentEditor: boolean;
        customStyles: string;
    } = $props();

    let query = $state(defaultQuery);

    let spaceModal = $state(true);

    function onKeyDown(event: KeyboardEvent) {
        event.stopPropagation();
        if (event.key !== "Tab") return;

        if (isDocumentEditor) return;

        spaceModal = !spaceModal;

        event.preventDefault();
    }
</script>

{@html customStyles}
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div onkeydown={onKeyDown}>
    {#if spaceModal}
        <ModalSpace bind:query {isDocumentEditor} />
    {:else}
        <ModalFile bind:query {currentPath} />
    {/if}
</div>
